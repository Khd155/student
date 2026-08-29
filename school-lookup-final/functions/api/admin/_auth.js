const COOKIE_NAME = "admin_token";
const SESSION_HOURS = 12;
const RATE_LIMIT_WINDOW_SEC = 600; // 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 8;

export function jsonHeaders(extra) {
  return { "Content-Type": "application/json", ...extra };
}

export function jsonResponse(body, status, extra) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: jsonHeaders(extra) });
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function requireAdmin(context) {
  const token = readCookie(context.request, COOKIE_NAME);
  if (!token) return null;

  const now = Date.now();
  const session = await context.env.DB.prepare(
    "SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?"
  ).bind(token, now).first();

  return session ? token : null;
}

export function setSessionCookie(token) {
  const maxAge = SESSION_HOURS * 3600;
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function createSession(env, token) {
  const expiresAt = Date.now() + SESSION_HOURS * 3600 * 1000;
  await env.DB.prepare("INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)")
    .bind(token, expiresAt).run();
}

export async function destroySession(env, token) {
  if (!token) return;
  await env.DB.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
}

export async function checkRateLimit(env, key) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").bind(key).first();

  if (!row || now - row.window_start > RATE_LIMIT_WINDOW_SEC) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) " +
      "ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start"
    ).bind(key, now).run();
    return true;
  }

  if (row.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }

  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}

export async function logActivity(env, type, detail, ip) {
  try {
    await env.DB.prepare(
      "INSERT INTO activity_log (type, detail, ip, created_at) VALUES (?, ?, ?, ?)"
    ).bind(type, detail || null, ip || null, Date.now()).run();
  } catch (_) {
    // best-effort logging; never block the request on a logging failure
  }
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
