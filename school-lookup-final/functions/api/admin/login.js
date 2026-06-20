import { createSession, sessionCookie } from "../../_utils/auth.js";
import { rateLimit, clientKey, tooManyRequests } from "../../_utils/rateLimit.js";
import { logActivity } from "../../_utils/activityLog.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => null);
  const headers = { "Content-Type": "application/json" };

  const allowed = await rateLimit(env, clientKey(request, "login"), 5, 15 * 60_000);
  if (!allowed) return tooManyRequests();

  if (!body?.password || body.password !== env.ADMIN_PASSWORD) {
    context.waitUntil(logActivity(env, request, "login_failed").catch(() => {}));
    return new Response(JSON.stringify({ error: "invalid_password" }), { status: 401, headers });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "db_not_bound" }), { status: 500, headers });
  }

  const token = await createSession(env);
  headers["Set-Cookie"] = sessionCookie(token);
  context.waitUntil(logActivity(env, request, "login_success").catch(() => {}));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
