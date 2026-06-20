export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/search") {
      return handleSearch(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("id")?.trim();

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (!studentId) {
    return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers });
  }

  try {
    const { results } = await env.DB.prepare(
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
