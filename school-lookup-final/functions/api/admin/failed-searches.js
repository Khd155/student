import { requireAdmin, unauthorized } from "../../_utils/auth.js";

export async function onRequestGet(context) {
  if (!(await requireAdmin(context))) return unauthorized();

  const { env } = context;
  const headers = { "Content-Type": "application/json" };

  const { results } = await env.DB.prepare(
    "SELECT attempted_id, created_at FROM failed_searches_log ORDER BY created_at DESC LIMIT 200"
  ).all();

  return new Response(JSON.stringify({ attempts: results }), { status: 200, headers });
}
