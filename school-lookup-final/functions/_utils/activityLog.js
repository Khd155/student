export async function logActivity(env, request, type, detail = "") {
  if (!env.DB) return;
  const ip = request?.headers.get("CF-Connecting-IP") || "unknown";
  await env.DB.prepare(
    "INSERT INTO activity_log (type, detail, ip, created_at) VALUES (?, ?, ?, ?)"
  ).bind(type, detail, ip, Date.now()).run();
}
