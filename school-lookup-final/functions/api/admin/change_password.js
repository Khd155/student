import { jsonResponse, requireAdmin, sha256Hex, getAdminPasswordHash, setAdminPasswordHash, logActivity, clientIp } from "./_auth.js";

export async function onRequestPost(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const currentPassword = (body && body.currentPassword) || "";
  const newPassword = (body && body.newPassword) || "";
  if (!newPassword || newPassword.length < 6) {
    return jsonResponse({ error: "weak_password" }, 400);
  }

  const storedHash = await getAdminPasswordHash(context.env);
  const currentHash = await sha256Hex(currentPassword);
  if (!storedHash || currentHash !== storedHash) {
    return jsonResponse({ error: "invalid_current_password" }, 401);
  }

  await setAdminPasswordHash(context.env, await sha256Hex(newPassword));
  await logActivity(context.env, "password_changed", null, clientIp(context.request));

  return jsonResponse({ ok: true });
}
