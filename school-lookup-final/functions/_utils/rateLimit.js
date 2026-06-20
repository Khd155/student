export function clientKey(request, scope) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return `${scope}:${ip}`;
}

export async function rateLimit(env, key, limit, windowMs) {
  if (!env.DB) return true;

  const now = Date.now();
  const row = await env.DB.prepare(
    "SELECT count, window_start FROM rate_limits WHERE key = ?"
  ).bind(key).first();

  if (!row || now - row.window_start > windowMs) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?"
    ).bind(key, now, now).run();
    return true;
  }

  if (row.count >= limit) return false;

  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}

export function tooManyRequests() {
  return new Response(JSON.stringify({ error: "too_many_requests" }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
