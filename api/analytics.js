import {
  getAnalyticsDatabase,
  getDateRange,
  getSessionFromRequest,
  sendJson,
  verifySessionToken
} from '../lib/analytics.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed.' });
  try {
    if (!verifySessionToken(getSessionFromRequest(request))) {
      return sendJson(response, 401, { error: 'Authentication required.' });
    }

    const range = getDateRange(request.query?.start, request.query?.end);
    const granularity = ['day', 'week', 'month'].includes(request.query?.group)
      ? request.query.group
      : 'day';
    if (!range) return sendJson(response, 400, { error: 'Choose a valid date range no longer than 366 days.' });

    const sql = await getAnalyticsDatabase();
    const [data] = await sql`
      WITH filtered AS (
        SELECT *
        FROM analytics_events
        WHERE created_at >= ${range.start}::date::timestamp AT TIME ZONE 'UTC'
          AND created_at < (${range.end}::date + 1)::timestamp AT TIME ZONE 'UTC'
      ),
      stats AS (
        SELECT COUNT(DISTINCT visitor_hash)::int AS total_visitors,
          COUNT(*)::int AS total_views,
          COUNT(DISTINCT visitor_hash) FILTER (
            WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          )::int AS visitors_today,
          COUNT(DISTINCT visitor_hash) FILTER (
            WHERE created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          )::int AS visitors_this_week,
          COUNT(DISTINCT visitor_hash) FILTER (
            WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          )::int AS visitors_this_month
        FROM analytics_events
        WHERE event_type = 'pageview'
      ),
      range_stats AS (
        SELECT COUNT(DISTINCT visitor_hash)::int AS range_visitors, COUNT(*)::int AS range_views
        FROM filtered
        WHERE event_type = 'pageview'
      ),
      chart AS (
        SELECT date_trunc(${granularity}, created_at AT TIME ZONE 'UTC') AS bucket,
          COUNT(DISTINCT visitor_hash)::int AS visitors,
          COUNT(*)::int AS views
        FROM filtered
        WHERE event_type = 'pageview'
        GROUP BY bucket
      ),
      pages AS (
        SELECT path AS label, COUNT(*)::int AS views
        FROM filtered
        WHERE event_type = 'pageview'
        GROUP BY path
        ORDER BY views DESC, label
        LIMIT 10
      ),
      sections AS (
        SELECT section AS label, COUNT(*)::int AS views
        FROM filtered
        WHERE event_type = 'section'
        GROUP BY section
        ORDER BY views DESC, label
        LIMIT 10
      ),
      case_studies AS (
        SELECT path AS label, COUNT(*)::int AS views
        FROM filtered
        WHERE event_type = 'pageview' AND path LIKE '/case-study/%'
        GROUP BY path
        ORDER BY views DESC, label
        LIMIT 10
      ),
      sources AS (
        SELECT COALESCE(referrer, 'Direct') AS label, COUNT(*)::int AS views
        FROM filtered
        WHERE event_type = 'pageview'
        GROUP BY label
        ORDER BY views DESC, label
        LIMIT 10
      ),
      devices AS (
        SELECT device AS label, COUNT(*)::int AS views
        FROM filtered
        WHERE event_type = 'pageview'
        GROUP BY device
        ORDER BY views DESC, label
      ),
      activity AS (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, event_type, COALESCE(section, path) AS label, COUNT(*)::int AS count
        FROM filtered
        GROUP BY day, event_type, label
        ORDER BY day DESC, count DESC
        LIMIT 12
      )
      SELECT stats.total_visitors, stats.total_views, stats.visitors_today,
        stats.visitors_this_week, stats.visitors_this_month, range_stats.range_visitors, range_stats.range_views,
        COALESCE((SELECT json_agg(json_build_object('date', bucket::date, 'visitors', visitors, 'views', views) ORDER BY bucket) FROM chart), '[]'::json) AS chart,
        COALESCE((SELECT json_agg(json_build_object('label', label, 'views', views) ORDER BY views DESC, label) FROM pages), '[]'::json) AS pages,
        COALESCE((SELECT json_agg(json_build_object('label', label, 'views', views) ORDER BY views DESC, label) FROM sections), '[]'::json) AS sections,
        COALESCE((SELECT json_agg(json_build_object('label', label, 'views', views) ORDER BY views DESC, label) FROM case_studies), '[]'::json) AS case_studies,
        COALESCE((SELECT json_agg(json_build_object('label', label, 'views', views) ORDER BY views DESC, label) FROM sources), '[]'::json) AS sources,
        COALESCE((SELECT json_agg(json_build_object('label', label, 'views', views) ORDER BY label) FROM devices), '[]'::json) AS devices,
        COALESCE((SELECT json_agg(json_build_object('date', day, 'type', event_type, 'label', label, 'count', count) ORDER BY day DESC, count DESC) FROM activity), '[]'::json) AS activity
      FROM stats CROSS JOIN range_stats
    `;
    return sendJson(response, 200, data);
  } catch (error) {
    console.error('Private analytics query failed.', error.message);
    return sendJson(response, 503, { error: 'Analytics data is temporarily unavailable.' });
  }
}
