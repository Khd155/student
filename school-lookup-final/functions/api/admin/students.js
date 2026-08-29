import { jsonResponse, requireAdmin, logActivity, clientIp } from "./_auth.js";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export async function onRequestGet(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  const url = new URL(context.request.url);
  const grade = url.searchParams.get("grade") || "";
  const klass = url.searchParams.get("class") || "";
  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(url.searchParams.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));

  const where = [];
  const params = [];
  if (grade) { where.push("grade = ?"); params.push(grade); }
  if (klass) { where.push("class = ?"); params.push(klass); }
  if (q) { where.push("(id LIKE ? OR name LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRow = await context.env.DB.prepare(`SELECT COUNT(*) as total FROM students ${whereSql}`)
    .bind(...params).first();
  const total = countRow ? countRow.total : 0;

  const offset = (page - 1) * pageSize;
  const { results } = await context.env.DB.prepare(
    `SELECT rowid as _id, id, name, grade, class, phone FROM students ${whereSql} ORDER BY grade, class, name LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();

  return jsonResponse({ students: results || [], total, page, pageSize });
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

  const { id, name, grade, class: klass, phone } = body || {};
  if (!id || !name || !grade || !klass) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  await context.env.DB.prepare(
    "INSERT INTO students (id, name, grade, class, phone) VALUES (?, ?, ?, ?, ?)"
  ).bind(String(id).trim(), String(name).trim(), String(grade).trim(), String(klass).trim(), phone ? String(phone).trim() : null).run();

  await logActivity(context.env, "student_create", `id=${id}`, clientIp(context.request));
  return jsonResponse({ ok: true });
}

export async function onRequestPut(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const { _id, id, name, grade, class: klass, phone } = body || {};
  if (!_id || !id || !name || !grade || !klass) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  await context.env.DB.prepare(
    "UPDATE students SET id = ?, name = ?, grade = ?, class = ?, phone = ? WHERE rowid = ?"
  ).bind(String(id).trim(), String(name).trim(), String(grade).trim(), String(klass).trim(), phone ? String(phone).trim() : null, _id).run();

  await logActivity(context.env, "student_update", `rowid=${_id} id=${id}`, clientIp(context.request));
  return jsonResponse({ ok: true });
}

export async function onRequestDelete(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  const url = new URL(context.request.url);
  const rowId = url.searchParams.get("_id");
  if (!rowId) return jsonResponse({ error: "missing_id" }, 400);

  await context.env.DB.prepare("DELETE FROM students WHERE rowid = ?").bind(rowId).run();

  await logActivity(context.env, "student_delete", `rowid=${rowId}`, clientIp(context.request));
  return jsonResponse({ ok: true });
}
