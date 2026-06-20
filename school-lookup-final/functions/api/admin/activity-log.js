import { requireAdmin, unauthorized } from "../../_utils/auth.js";

export async function onRequestGet(context) {
  if (!(await requireAdmin(context))) return unauthorized();

  const { env } = context;
  const headers = { "Content-Type": "application/json" };

  const { results } = await env.DB.prepare(
    "SELECT type, detail, ip, created_at FROM activity_log ORDER BY created_at DESC LIMIT 300"
  ).all();

  return new Response(JSON.stringify({ entries: results }), { status: 200, headers });
}
