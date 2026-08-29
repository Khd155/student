import { jsonResponse, setSessionCookie, createSession, checkRateLimit, logActivity, clientIp, sha256Hex, getAdminPasswordHash } from "./_auth.js";

export async function onRequestPost(context) {
  const ip = clientIp(context.request);

  const allowed = await checkRateLimit(context.env, `login:${ip}`);
  if (!allowed) {
    return jsonResponse({ error: "too_many_attempts" }, 429);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const password = (body && body.password) || "";
  const storedHash = await getAdminPasswordHash(context.env);
  const submittedHash = await sha256Hex(password);
  if (!storedHash || submittedHash !== storedHash) {
    await logActivity(context.env, "login_failed", null, ip);
    return jsonResponse({ error: "invalid_password" }, 401);
  }

  const token = crypto.randomUUID();
  await createSession(context.env, token);
  await logActivity(context.env, "login", null, ip);

  return jsonResponse({ ok: true }, 200, { "Set-Cookie": setSessionCookie(token) });
}
