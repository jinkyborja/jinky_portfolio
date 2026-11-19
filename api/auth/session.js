import {
  getSessionFromRequest,
  sendJson,
  verifySessionToken
} from '../../lib/analytics.js';

export default function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed.' });
  try {
    return sendJson(response, 200, {
      authenticated: verifySessionToken(getSessionFromRequest(request))
    });
  } catch (error) {
    console.error('Analytics session check failed.', error.message);
    return sendJson(response, 503, { error: 'Analytics sign-in is temporarily unavailable.' });
  }
}
