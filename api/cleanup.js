import { getAnalyticsDatabase, sendJson } from '../lib/analytics.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed.' });
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.authorization;
  if (!expected || authorization !== `Bearer ${expected}`) {
    return sendJson(response, 401, { error: 'Unauthorized.' });
  }

  try {
    const sql = await getAnalyticsDatabase();
    const deleted = await sql`DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '13 months' RETURNING id`;
    return sendJson(response, 200, { deleted: deleted.length });
  } catch (error) {
    console.error('Analytics retention cleanup failed.', error.message);
    return sendJson(response, 503, { error: 'Analytics cleanup failed.' });
  }
}
