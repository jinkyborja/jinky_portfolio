import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import {
  createSessionToken,
  getDateRange,
  getDevice,
  getReferrer,
  normalizeAnalyticsEvent,
  normalizePagePath,
  verifySessionToken
} from '../lib/analytics.js';
import analyticsHandler from '../api/analytics.js';
import loginHandler from '../api/auth/login.js';
import trackHandler from '../api/track.js';

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(body) {
      this.body = body;
    }
  };
}

test('only allowlisted portfolio routes and section events are accepted', () => {
  const visitorId = '550e8400-e29b-41d4-a716-446655440000';
  assert.deepEqual(normalizeAnalyticsEvent({
    type: 'pageview',
    visitorId,
    path: '/',
    section: 'projects'
  }), {
    type: 'pageview',
    visitorId,
    path: '/#projects',
    section: 'projects',
    referrer: ''
  });
  assert.equal(normalizeAnalyticsEvent({ type: 'section', visitorId, path: '/', section: 'unknown' }), null);
  assert.equal(normalizeAnalyticsEvent({ type: 'pageview', visitorId, path: '/analytics/', section: null }), null);
  assert.equal(normalizePagePath('//external.example/'), null);
  assert.equal(normalizePagePath('/case-study/essu-docuflow/index.html'), '/case-study/essu-docuflow/');
  assert.equal(normalizePagePath('/privacy.html'), '/privacy.html');
});

test('device and referral data are reduced to broad categories and domains', () => {
  assert.equal(getDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
  assert.equal(getDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'mobile');
  assert.equal(getDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
  assert.equal(getReferrer('https://search.example/results?q=private', 'jinkysuson.vercel.app'), 'search.example');
  assert.equal(getReferrer('https://jinkysuson.vercel.app/case-study/?private=yes', 'jinkysuson.vercel.app'), 'Internal navigation');
  assert.equal(getReferrer('javascript:alert(1)', 'jinkysuson.vercel.app'), null);
});

test('owner session tokens are signed and expire', () => {
  const originalSecret = process.env.ANALYTICS_SESSION_SECRET;
  const originalEmail = process.env.ANALYTICS_OWNER_EMAIL;
  process.env.ANALYTICS_SESSION_SECRET = 'test-secret-with-more-than-32-characters';
  process.env.ANALYTICS_OWNER_EMAIL = 'owner@example.test';
  try {
    const now = Date.UTC(2026, 0, 1);
    const token = createSessionToken(now);
    assert.equal(verifySessionToken(token, now), true);
    assert.equal(verifySessionToken(`${token}x`, now), false);
    assert.equal(verifySessionToken(token, now + 8 * 60 * 60 * 1000), false);
  } finally {
    if (originalSecret === undefined) delete process.env.ANALYTICS_SESSION_SECRET;
    else process.env.ANALYTICS_SESSION_SECRET = originalSecret;
    if (originalEmail === undefined) delete process.env.ANALYTICS_OWNER_EMAIL;
    else process.env.ANALYTICS_OWNER_EMAIL = originalEmail;
  }
});

test('analytics read endpoint rejects requests without an owner session', async () => {
  const response = createResponse();
  await analyticsHandler({
    method: 'GET',
    headers: { cookie: '' },
    query: { start: '2026-01-01', end: '2026-01-31' }
  }, response);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Authentication required.' });
  assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
});

test('public event ingestion accepts only same-origin requests and valid events', async () => {
  const request = {
    method: 'POST',
    headers: { origin: 'https://other.example', host: 'portfolio.example' },
    body: { type: 'pageview', visitorId: '550e8400-e29b-41d4-a716-446655440000', path: '/' }
  };
  const crossOrigin = createResponse();
  await trackHandler(request, crossOrigin);
  assert.equal(crossOrigin.statusCode, 403);

  request.headers.origin = 'https://portfolio.example';
  request.body.path = '/not-a-portfolio-route';
  const invalidEvent = createResponse();
  await trackHandler(request, invalidEvent);
  assert.equal(invalidEvent.statusCode, 400);
});

test('only the configured owner can obtain a secure analytics session', async () => {
  const originalSecret = process.env.ANALYTICS_SESSION_SECRET;
  const originalEmail = process.env.ANALYTICS_OWNER_EMAIL;
  const originalPasswordHash = process.env.ANALYTICS_OWNER_PASSWORD_HASH;
  const salt = Buffer.alloc(16, 23);
  const hash = pbkdf2Sync('correct horse battery staple', salt, 210000, 32, 'sha256');
  process.env.ANALYTICS_SESSION_SECRET = 'test-secret-with-more-than-32-characters';
  process.env.ANALYTICS_OWNER_EMAIL = 'owner@example.test';
  process.env.ANALYTICS_OWNER_PASSWORD_HASH = `${salt.toString('base64url')}:${hash.toString('base64url')}`;

  try {
    const request = {
      method: 'POST',
      headers: { origin: 'https://portfolio.example', host: 'portfolio.example' },
      body: { email: 'other@example.test', password: 'correct horse battery staple' }
    };
    const rejected = createResponse();
    await loginHandler(request, rejected);
    assert.equal(rejected.statusCode, 401);

    request.body.email = 'owner@example.test';
    const accepted = createResponse();
    await loginHandler(request, accepted);
    assert.equal(accepted.statusCode, 200);
    assert.match(accepted.headers['Set-Cookie'], /HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
    const token = decodeURIComponent(accepted.headers['Set-Cookie'].split(';')[0].split('=')[1]);
    assert.equal(verifySessionToken(token), true);
  } finally {
    if (originalSecret === undefined) delete process.env.ANALYTICS_SESSION_SECRET;
    else process.env.ANALYTICS_SESSION_SECRET = originalSecret;
    if (originalEmail === undefined) delete process.env.ANALYTICS_OWNER_EMAIL;
    else process.env.ANALYTICS_OWNER_EMAIL = originalEmail;
    if (originalPasswordHash === undefined) delete process.env.ANALYTICS_OWNER_PASSWORD_HASH;
    else process.env.ANALYTICS_OWNER_PASSWORD_HASH = originalPasswordHash;
  }
});

test('date filters reject invalid, reversed, and overlong ranges', () => {
  const now = new Date('2026-01-31T12:00:00Z');
  assert.deepEqual(getDateRange('2026-01-01', '2026-01-31', now), { start: '2026-01-01', end: '2026-01-31' });
  assert.equal(getDateRange('2026-02-01', '2026-01-31', now), null);
  assert.equal(getDateRange('2025-01-01', '2026-01-31', now), null);
  assert.equal(getDateRange('2026-02-30', '2026-03-01', now), null);
});
