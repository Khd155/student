import { requireAdmin, unauthorized } from "../../_utils/auth.js";
import { logActivity } from "../../_utils/activityLog.js";

export async function onRequestGet(context) {
  if (!(await requireAdmin(context))) return unauthorized();

  const { env, request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const headers = { "Content-Type": "application/json" };

  const result = q
    ? await env.DB.prepare(
        "SELECT * FROM students WHERE id LIKE ? OR name LIKE ? ORDER BY id LIMIT 200"
      ).bind(`%${q}%`, `%${q}%`).all()
    : await env.DB.prepare("SELECT * FROM students ORDER BY id LIMIT 200").all();

  return new Response(JSON.stringify({ students: result.results }), { status: 200, headers });
}

export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return unauthorized();

  const { env, request } = context;
  const body = await request.json().catch(() => null);
  const headers = { "Content-Type": "application/json" };

  if (!body?.id || !body?.name) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers });
  }

  await env.DB.prepare(
    "INSERT INTO students (id,name,seat,committee,location,grade,class) VALUES (?,?,?,?,?,?,?)"
  ).bind(body.id, body.name, body.seat || "", body.committee || "", body.location || "", body.grade || "", body.class || "").run();

  context.waitUntil(logActivity(env, request, "student_created", `${body.id} - ${body.name}`).catch(() => {}));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function onRequestPut(context) {
  if (!(await requireAdmin(context))) return unauthorized();

  const { env, request } = context;
  const body = await request.json().catch(() => null);
  const headers = { "Content-Type": "application/json" };

  if (!body?.id) {
    return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers });
  }

  await env.DB.prepare(
    "UPDATE students SET name=?, seat=?, committee=?, location=?, grade=?, class=? WHERE id=?"
  ).bind(body.name, body.seat, body.committee, body.location, body.grade, body.class, body.id).run();

  context.waitUntil(logActivity(env, request, "student_updated", `${body.id} - ${body.name}`).catch(() => {}));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function onRequestDelete(context) {
  if (!(await requireAdmin(context))) return unauthorized();

  const { env, request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const headers = { "Content-Type": "application/json" };

  if (!id) {
    return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers });
  }

  await env.DB.prepare("DELETE FROM students WHERE id=?").bind(id).run();
  context.waitUntil(logActivity(env, request, "student_deleted", id).catch(() => {}));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
