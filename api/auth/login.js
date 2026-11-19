import {
  isSameOrigin,
  parseJsonBody,
  sendJson,
  setSessionCookie,
  createSessionToken,
  verifyOwnerPassword
} from '../../lib/analytics.js';

export default function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
  if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Request origin is not allowed.' });

  const body = parseJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const ownerEmail = process.env.ANALYTICS_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail || !process.env.ANALYTICS_OWNER_PASSWORD_HASH
    || email !== ownerEmail || !verifyOwnerPassword(body?.password)) {
    return sendJson(response, 401, { error: 'Email or password is incorrect.' });
  }

  try {
    setSessionCookie(response, request, createSessionToken());
    return sendJson(response, 200, { authenticated: true });
  } catch (error) {
    console.error('Analytics authentication is not configured.', error.message);
    return sendJson(response, 503, { error: 'Analytics sign-in is temporarily unavailable.' });
  }
}
