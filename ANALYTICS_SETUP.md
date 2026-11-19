# Private portfolio analytics setup

The site is static, so analytics use Vercel Node.js functions and a Neon PostgreSQL database. The dashboard shell is public static HTML, but it contains no analytics records; the data API requires the owner-only signed session cookie. There is no registration endpoint or public analytics read endpoint.

## Provision the database

1. Create a Neon project and copy its pooled connection string.
2. Run [`database/analytics.sql`](database/analytics.sql) in the Neon SQL Editor.
3. Keep the connection string private; add it to the Vercel project as `DATABASE_URL`.

## Configure owner access

1. Run `node scripts\hash-password.mjs` locally and enter a strong, unique password (at least 12 characters). Save the printed `ANALYTICS_OWNER_PASSWORD_HASH` value in a password manager.
2. In Vercel Project Settings → Environment Variables, set:
   - `ANALYTICS_OWNER_EMAIL`: the owner account email address.
   - `ANALYTICS_OWNER_PASSWORD_HASH`: the complete value printed by the password tool.
   - `ANALYTICS_SESSION_SECRET`: a private random value of at least 32 bytes (for example, generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`).
   - `DATABASE_URL`: the Neon connection string.
   - `CRON_SECRET`: a separate long random value used to authorize the scheduled retention cleanup.
3. Add the values to Production and any Preview environments where analytics should run. Do not commit them or place them in client-side environment variables.
4. Deploy the site to Vercel. Visit `/analytics/` and sign in with the configured owner email and password.

The daily Vercel Cron job deletes event records older than 13 months. Keep `CRON_SECRET` configured for the cleanup job to run.

## Consent and data handling

Tracking starts only after a visitor accepts the consent banner. Declining prevents event collection. A random browser identifier is retained for up to 12 months and is hashed server-side before storage. Events store only an allowlisted page/section, the referring domain (not its path or query), a coarse device category, and a timestamp. No IP address or raw user-agent is stored by the application. Visitors can withdraw consent using the privacy settings; that removes the local identifier and stops future collection.

## Local checks and deployment smoke test

- Run `npm test` and `node --check` on the API and browser scripts.
- After deployment, accept analytics on the public homepage, visit a case study and another section, then verify the owner dashboard shows the new events.
- Refresh a page: page views may increase, but the distinct visitor count should not.
- Sign out, then request `/api/analytics` directly. It must return `401` with no analytics data. Only a successful owner login should receive a session cookie and dashboard response.

Analytics remain unavailable until the database migration and Vercel environment variables are configured.
