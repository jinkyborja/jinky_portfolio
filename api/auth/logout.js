import { clearSessionCookie, isSameOrigin, sendJson } from '../../lib/analytics.js';

export default function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
  if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Request origin is not allowed.' });
  clearSessionCookie(response, request);
  return sendJson(response, 200, { authenticated: false });
}
