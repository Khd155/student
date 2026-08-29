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

    if (!results || results.length === 0) {
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
