import { requireAdmin, unauthorized } from "../../_utils/auth.js";

export async function onRequestGet(context) {
  if (!(await requireAdmin(context))) return unauthorized();

  const { env } = context;
  const headers = { "Content-Type": "application/json" };

  const statsRows = await env.DB.prepare("SELECT key, value FROM stats").all();
  const counters = {};
  for (const row of statsRows.results) counters[row.key] = row.value;

  const total = await env.DB.prepare("SELECT COUNT(*) as c FROM students").first();
  const byGrade = await env.DB.prepare(
    "SELECT grade, COUNT(*) as count FROM students GROUP BY grade ORDER BY grade"
  ).all();

  return new Response(JSON.stringify({
    pageViews: counters.page_views || 0,
    searches: counters.searches || 0,
    failedSearches: counters.failed_searches || 0,
    totalStudents: total.c,
    byGrade: byGrade.results,
  }), { status: 200, headers });
}
