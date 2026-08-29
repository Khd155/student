import { jsonResponse, requireAdmin } from "./_auth.js";

const RECENT_LIMIT = 15;

export async function onRequestGet(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  const totalsRow = await context.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN found = 1 THEN 1 ELSE 0 END) as successful,
       COUNT(DISTINCT national_id_searched) as unique_ids
     FROM search_logs`
  ).first();

  const { results: recent } = await context.env.DB.prepare(
    `SELECT national_id_searched, found, searched_at
     FROM search_logs
     ORDER BY searched_at DESC
     LIMIT ?`
  ).bind(RECENT_LIMIT).all();

  const total = (totalsRow && totalsRow.total) || 0;
  const successful = (totalsRow && totalsRow.successful) || 0;

  return jsonResponse({
    totalSearches: total,
    successfulSearches: successful,
    failedSearches: total - successful,
    uniqueSearches: (totalsRow && totalsRow.unique_ids) || 0,
    recentSearches: recent || [],
  });
}
