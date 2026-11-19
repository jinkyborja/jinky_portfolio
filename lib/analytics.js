import { createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'portfolio-analytics-session';
const SESSION_LENGTH_SECONDS = 8 * 60 * 60;

export const portfolioSections = new Set([
  'intro', 'about', 'skills', 'projects', 'designs', 'process', 'contact'
]);

export const caseStudyPaths = new Set([
  '/case-study/e-index-system/',
  '/case-study/essu-docuflow/',
  '/case-study/rfid-library-system/',
  '/case-study/sapao-coast-extensions/'
]);

export function sendJson(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.json(body);
}

export function isSameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return false;

  try {
    const parsedOrigin = new URL(origin);
    const isLocal = host.startsWith('localhost:') || host.startsWith('127.0.0.1:');
    const protocol = request.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
    return parsedOrigin.host.toLowerCase() === host.toLowerCase()
      && parsedOrigin.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

export function parseJsonBody(request) {
  if (Number(request.headers['content-length']) > 2048) return null;
  if (typeof request.body === 'string') {
    if (Buffer.byteLength(request.body) > 2048) return null;
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }
  if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)) {
    return Buffer.byteLength(JSON.stringify(request.body)) <= 2048 ? request.body : null;
  }
  return null;
}

export function normalizePagePath(value) {
  if (typeof value !== 'string' || value.length > 200 || !value.startsWith('/') || value.startsWith('//')) return null;
  const pathname = value.split(/[?#]/, 1)[0].replace(/\/index\.html$/, '/');
  if (pathname === '/') return '/';
  if (pathname === '/privacy.html') return pathname;
  return caseStudyPaths.has(pathname) ? pathname : null;
}

export function normalizeAnalyticsEvent(body) {
  if (!body || !['pageview', 'section'].includes(body.type)) return null;
  if (typeof body.visitorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.visitorId)) return null;
  const path = normalizePagePath(body.path);
  if (!path) return null;

  const section = typeof body.section === 'string' && portfolioSections.has(body.section)
    ? body.section
    : null;
  if (section && path !== '/') return null;
  if (body.type === 'section' && (path !== '/' || !section)) return null;

  return {
    type: body.type,
    visitorId: body.visitorId.toLowerCase(),
    path: body.type === 'pageview' && path === '/' && section ? `/#${section}` : path,
    section,
    referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 2048) : ''
  };
}

export function getDevice(userAgent = '') {
  if (/ipad|tablet|kindle|silk|playbook/i.test(userAgent)
    || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export function getReferrer(value, requestHost) {
  if (!value) return null;
  try {
    const referrer = new URL(value);
    if (!['http:', 'https:'].includes(referrer.protocol)) return null;
    return referrer.host.toLowerCase() === String(requestHost).toLowerCase()
      ? 'Internal navigation'
      : referrer.hostname.toLowerCase().slice(0, 253);
  } catch {
    return null;
  }
}

function getSessionSecret() {
  const secret = process.env.ANALYTICS_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('ANALYTICS_SESSION_SECRET must contain at least 32 bytes.');
  return secret;
}

function getOwnerEmail() {
  const email = process.env.ANALYTICS_OWNER_EMAIL;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ANALYTICS_OWNER_EMAIL is missing or invalid.');
  return email.toLowerCase();
}

function signature(payload) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: getOwnerEmail(),
    exp: Math.floor(now / 1000) + SESSION_LENGTH_SECONDS
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1024) return false;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(payload));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.sub === getOwnerEmail()
      && Number.isInteger(session.exp)
      && session.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function getSessionFromRequest(request) {
  const cookie = request.headers.cookie || '';
  const entry = cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(SESSION_COOKIE.length + 1)) : '';
}

export function setSessionCookie(response, request, token) {
  const host = request.headers.host || '';
  const isLocal = host.startsWith('localhost:') || host.startsWith('127.0.0.1:');
  const secure = !isLocal || request.headers['x-forwarded-proto'] === 'https';
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_LENGTH_SECONDS}${secure ? '; Secure' : ''}`);
}

export function clearSessionCookie(response, request) {
  const host = request.headers.host || '';
  const isLocal = host.startsWith('localhost:') || host.startsWith('127.0.0.1:');
  const secure = !isLocal || request.headers['x-forwarded-proto'] === 'https';
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}

export function verifyOwnerPassword(password) {
  const encoded = process.env.ANALYTICS_OWNER_PASSWORD_HASH || '';
  const [salt, storedHash] = encoded.split(':');
  if (typeof password !== 'string' || password.length > 1024 || !salt || !storedHash) return false;

  let saltBytes;
  let hashBytes;
  try {
    saltBytes = Buffer.from(salt, 'base64url');
    hashBytes = Buffer.from(storedHash, 'base64url');
  } catch {
    return false;
  }
  if (saltBytes.length < 16 || hashBytes.length !== 32) return false;

  const candidate = pbkdf2Sync(password, saltBytes, 210000, 32, 'sha256');
  return timingSafeEqual(candidate, hashBytes);
}

export function getDateRange(start, end, now = new Date()) {
  const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (start && !validDate(start)) return null;
  if (end && !validDate(end)) return null;
  const endDate = end || now.toISOString().slice(0, 10);
  const startDate = start || new Date(Date.parse(`${endDate}T00:00:00.000Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const duration = Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`);
  if (duration < 0 || duration > 365 * 86400000) return null;
  return { start: startDate, end: endDate };
}

export function getAnalyticsDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  return import('@neondatabase/serverless').then(({ neon }) => neon(process.env.DATABASE_URL));
}
