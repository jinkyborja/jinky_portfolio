import { createHash } from 'node:crypto';
import {
  getAnalyticsDatabase,
  getDevice,
  getReferrer,
  isSameOrigin,
  normalizeAnalyticsEvent,
  parseJsonBody,
  sendJson
} from '../lib/analytics.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
  if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Request origin is not allowed.' });

  const event = normalizeAnalyticsEvent(parseJsonBody(request));
  if (!event) return sendJson(response, 400, { error: 'Invalid analytics event.' });

  try {
    const sql = await getAnalyticsDatabase();
    const visitorHash = createHash('sha256').update(event.visitorId).digest('hex');
    const referrer = event.type === 'pageview'
      ? getReferrer(event.referrer, request.headers.host)
      : null;
    await sql`
      INSERT INTO analytics_events (visitor_hash, event_type, path, section, referrer, device)
      VALUES (
        ${visitorHash},
        ${event.type},
        ${event.path},
        ${event.section},
        ${referrer},
        ${getDevice(request.headers['user-agent'] || '')}
      )
    `;
    return sendJson(response, 202, { recorded: true });
  } catch (error) {
    console.error('Analytics event could not be stored.', error.message);
    return sendJson(response, 503, { error: 'Analytics tracking is temporarily unavailable.' });
  }
}
