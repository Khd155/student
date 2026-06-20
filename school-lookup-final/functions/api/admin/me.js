import { requireAdmin } from "../../_utils/auth.js";

export async function onRequestGet(context) {
  const ok = await requireAdmin(context);
  return new Response(JSON.stringify({ authenticated: ok }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
