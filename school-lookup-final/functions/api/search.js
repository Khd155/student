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

  context.waitUntil(
    context.env.DB.prepare(
      "INSERT INTO stats(key,value) VALUES('searches',1) ON CONFLICT(key) DO UPDATE SET value=value+1"
    ).run().catch(() => {})
  );

  try {
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM students WHERE id = ? OR LOWER(id) = LOWER(?)"
    ).bind(studentId, studentId).all();

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ found: false }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ found: true, students: results }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
