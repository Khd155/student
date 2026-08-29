import { jsonResponse, clearSessionCookie, destroySession, logActivity, clientIp } from "./_auth.js";

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequestPost(context) {
  const token = readCookie(context.request, "admin_token");
  await destroySession(context.env, token);
  await logActivity(context.env, "logout", null, clientIp(context.request));
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
