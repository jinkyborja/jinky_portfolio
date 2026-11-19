CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_hash CHAR(64) NOT NULL CHECK (visitor_hash ~ '^[0-9a-f]{64}$'),
  event_type TEXT NOT NULL CHECK (event_type IN ('pageview', 'section')),
  path TEXT NOT NULL CHECK (length(path) <= 200),
  section TEXT CHECK (section IS NULL OR section IN ('intro', 'about', 'skills', 'projects', 'designs', 'process', 'contact')),
  referrer TEXT CHECK (referrer IS NULL OR length(referrer) <= 253),
  device TEXT NOT NULL CHECK (device IN ('desktop', 'mobile', 'tablet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS analytics_events_type_created_at_idx
  ON analytics_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_created_at_idx
  ON analytics_events (visitor_hash, created_at);

REVOKE ALL ON TABLE analytics_events FROM PUBLIC;
