import { jsonResponse, requireAdmin } from "./_auth.js";

export async function onRequestGet(context) {
  const token = await requireAdmin(context);
  return jsonResponse({ authenticated: !!token });
}
