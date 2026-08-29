import { jsonResponse, requireAdmin, logActivity, clientIp } from "./_auth.js";

export async function onRequestGet(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  const { results } = await context.env.DB.prepare(
    "SELECT code, grade_name, created_at FROM grade_mappings ORDER BY code"
  ).all();

  return jsonResponse({ mappings: results || [] });
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

  const code = (body && body.code || "").trim();
  const gradeName = (body && body.grade_name || "").trim();
  if (!code || !gradeName) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  try {
    await context.env.DB.prepare(
      "INSERT INTO grade_mappings (code, grade_name, created_at) VALUES (?, ?, ?)"
    ).bind(code, gradeName, Date.now()).run();
  } catch (err) {
    return jsonResponse({ error: "duplicate_code", message: err.message }, 409);
  }

  await logActivity(context.env, "grade_mapping_create", `code=${code} name=${gradeName}`, clientIp(context.request));
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

  const code = (body && body.code || "").trim();
  const gradeName = (body && body.grade_name || "").trim();
  if (!code || !gradeName) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  await context.env.DB.prepare(
    "UPDATE grade_mappings SET grade_name = ? WHERE code = ?"
  ).bind(gradeName, code).run();

  await logActivity(context.env, "grade_mapping_update", `code=${code} name=${gradeName}`, clientIp(context.request));
  return jsonResponse({ ok: true });
}

export async function onRequestDelete(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  if (!code) return jsonResponse({ error: "missing_code" }, 400);

  await context.env.DB.prepare("DELETE FROM grade_mappings WHERE code = ?").bind(code).run();

  await logActivity(context.env, "grade_mapping_delete", `code=${code}`, clientIp(context.request));
  return jsonResponse({ ok: true });
}
