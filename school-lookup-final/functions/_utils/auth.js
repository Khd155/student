const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

export async function createSession(env) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await env.DB.prepare(
    "INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)"
  ).bind(token, expiresAt).run();
  return token;
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export async function requireAdmin(context) {
  if (!context.env.DB) return false;

  const token = getCookie(context.request, SESSION_COOKIE);
  if (!token) return false;

  const row = await context.env.DB.prepare(
    "SELECT expires_at FROM admin_sessions WHERE token = ?"
  ).bind(token).first();

  return Boolean(row) && row.expires_at > Date.now();
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
