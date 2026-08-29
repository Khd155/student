async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function logSearch(env, request, studentId, found) {
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const ipHash = ip ? await sha256Hex(ip) : null;
    const userAgent = (request.headers.get("User-Agent") || "").slice(0, 255);

    await env.DB.prepare(
      "INSERT INTO search_logs (national_id_searched, found, searched_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?)"
    ).bind(studentId, found ? 1 : 0, Date.now(), ipHash, userAgent || null).run();
  } catch (_) {
    // best-effort logging; never let it affect the search response
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const studentId = url.searchParams.get("id")?.trim();

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (!studentId) {
    return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers });
  }

  try {
    const { results } = await context.env.DB.prepare(
      "SELECT id, name, grade, class FROM students WHERE id = ? OR LOWER(id) = LOWER(?)"
    ).bind(studentId, studentId).all();

    const found = !!(results && results.length);
    context.waitUntil(logSearch(context.env, context.request, studentId, found));

    if (!found) {
      return new Response(JSON.stringify({ found: false }), { status: 200, headers });
    }

    const student = results[0];

    const visibility = await context.env.DB.prepare(
      "SELECT enabled FROM class_visibility WHERE grade = ? AND class = ?"
    ).bind(student.grade, student.class).first();

    if (visibility && visibility.enabled === 0) {
      return new Response(JSON.stringify({ found: true, disabled: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ found: true, students: [student] }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
