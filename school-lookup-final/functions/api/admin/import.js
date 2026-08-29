import { jsonResponse, requireAdmin, logActivity, clientIp } from "./_auth.js";

const CHUNK_SIZE = 100;

function buildInsertStatement(env, rows) {
  const placeholders = rows.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const sql = `INSERT INTO students (id, name, grade, class, phone) VALUES ${placeholders}`;
  const params = [];
  for (const r of rows) {
    params.push(r.id, r.name, r.grade, r.class, r.phone || null);
  }
  return env.DB.prepare(sql).bind(...params);
}

export async function onRequestPost(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const { mode, grade, rows } = body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({ error: "no_rows" }, 400);
  }
  if (mode !== "replace_all" && mode !== "replace_grade") {
    return jsonResponse({ error: "invalid_mode" }, 400);
  }
  if (mode === "replace_grade" && !grade) {
    return jsonResponse({ error: "missing_grade" }, 400);
  }

  const cleanRows = [];
  for (const r of rows) {
    if (!r || !r.id || !r.name || !r.grade || !r.class) continue;
    if (mode === "replace_grade" && String(r.grade).trim() !== String(grade).trim()) continue;
    cleanRows.push({
      id: String(r.id).trim(),
      name: String(r.name).trim(),
      grade: String(r.grade).trim(),
      class: String(r.class).trim(),
      phone: r.phone ? String(r.phone).trim() : null,
    });
  }

  if (cleanRows.length === 0) {
    return jsonResponse({ error: "no_valid_rows" }, 400);
  }

  const statements = [];
  if (mode === "replace_all") {
    statements.push(context.env.DB.prepare("DELETE FROM students"));
  } else {
    statements.push(context.env.DB.prepare("DELETE FROM students WHERE grade = ?").bind(grade));
  }

  for (let i = 0; i < cleanRows.length; i += CHUNK_SIZE) {
    statements.push(buildInsertStatement(context.env, cleanRows.slice(i, i + CHUNK_SIZE)));
  }

  await context.env.DB.batch(statements);

  await logActivity(
    context.env,
    "import",
    `mode=${mode} grade=${grade || "*"} rows=${cleanRows.length}`,
    clientIp(context.request)
  );

  return jsonResponse({ ok: true, imported: cleanRows.length, skipped: rows.length - cleanRows.length });
}
