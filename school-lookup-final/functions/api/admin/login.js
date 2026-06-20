import { createSession, sessionCookie } from "../../_utils/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => null);
  const headers = { "Content-Type": "application/json" };

  if (!body?.password || body.password !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "invalid_password" }), { status: 401, headers });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "db_not_bound" }), { status: 500, headers });
  }

  const token = await createSession(env);
  headers["Set-Cookie"] = sessionCookie(token);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
