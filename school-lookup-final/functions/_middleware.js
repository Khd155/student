export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (url.pathname === "/" && env.DB) {
    context.waitUntil(
      env.DB.prepare(
        "INSERT INTO stats(key,value) VALUES('page_views',1) ON CONFLICT(key) DO UPDATE SET value=value+1"
      ).run().catch(() => {})
    );
  }

  return next();
}
