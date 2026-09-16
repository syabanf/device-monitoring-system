-- Integration settings move off the browser so every admin in a distribution center sees the
-- same channels, and the server can read them when it delivers.
CREATE TABLE integration_config (
  distributor_id text PRIMARY KEY REFERENCES distributor(id) ON DELETE CASCADE,
  settings jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The dashboard asks for the newest reading of every sensor on each load.
CREATE INDEX reading_sensor_recent_idx ON reading (sensor_id, at DESC);

-- request_log rows are read per distribution center on the Integration page.
CREATE INDEX request_log_tenant_idx ON request_log (distributor_id, at DESC);
