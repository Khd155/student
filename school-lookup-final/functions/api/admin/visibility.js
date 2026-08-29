import { jsonResponse, requireAdmin, logActivity, clientIp } from "./_auth.js";

export async function onRequestGet(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  const { results } = await context.env.DB.prepare(
    `SELECT s.grade as grade, s.class as class, COUNT(*) as student_count,
            COALESCE(v.enabled, 1) as enabled
     FROM students s
     LEFT JOIN class_visibility v ON v.grade = s.grade AND v.class = s.class
     GROUP BY s.grade, s.class
     ORDER BY s.grade, s.class`
  ).all();

  return jsonResponse({ items: results || [] });
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

  const { grade, class: klass, enabled } = body || {};
  if (!grade || !klass || typeof enabled !== "boolean") {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  await context.env.DB.prepare(
    `INSERT INTO class_visibility (grade, class, enabled) VALUES (?, ?, ?)
     ON CONFLICT(grade, class) DO UPDATE SET enabled = excluded.enabled`
  ).bind(grade, klass, enabled ? 1 : 0).run();

  await logActivity(
    context.env,
    "visibility_toggle",
    `grade=${grade} class=${klass} enabled=${enabled}`,
    clientIp(context.request)
  );

  return jsonResponse({ ok: true });
}
