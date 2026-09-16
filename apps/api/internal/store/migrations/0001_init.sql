-- Mirrors packages/types. Enum values match the domain unions exactly so repos map rows
-- to domain structs without translation tables.
CREATE TYPE sensor_type AS ENUM ('TEMPERATURE','TEMPERATURE_HUMIDITY','DOOR','MOTION','POWER','PANIC_BUTTON');
CREATE TYPE port_kind AS ENUM ('digital','switch','analog');
CREATE TYPE device_status AS ENUM ('online','offline');
CREATE TYPE alert_status AS ENUM ('UNACKNOWLEDGED','ACKNOWLEDGED','RESPONDING','RESOLVED','VERIFIED');
CREATE TYPE alert_category AS ENUM ('COMFORT','SECURITY');
CREATE TYPE registration_status AS ENUM ('pending','approved');
CREATE TYPE employee_role AS ENUM ('store_manager','assistant_manager','cashier','staff');
CREATE TYPE channel AS ENUM ('app','telegram');
CREATE TYPE maintenance_kind AS ENUM ('PREVENTIVE','CORRECTIVE','REPLACEMENT','INSTALLATION','FIRMWARE');
CREATE TYPE ticket_status AS ENUM ('OPEN','SCHEDULED','IN_PROGRESS','DONE');
CREATE TYPE ticket_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');

CREATE TABLE distributor (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  region text NOT NULL,
  city text NOT NULL,
  address text NOT NULL,
  admin_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_user (
  id text PRIMARY KEY,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  avatar_color text NOT NULL
);

CREATE TABLE outlet (
  id text PRIMARY KEY,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  maps_url text NOT NULL,
  open_time text NOT NULL,
  close_time text NOT NULL,
  timezone text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distributor_id, code)
);
CREATE INDEX outlet_distributor_idx ON outlet (distributor_id);

CREATE TABLE device_type (
  id text PRIMARY KEY,
  -- text, not an enum: admins add Room Alert models as master data.
  model text NOT NULL UNIQUE,
  name text NOT NULL,
  vendor text NOT NULL,
  ports jsonb NOT NULL,
  built_in_sensors text[] NOT NULL DEFAULT '{}',
  description text NOT NULL,
  price_idr bigint NOT NULL,
  latest_firmware text NOT NULL,
  maintenance_interval_days int NOT NULL
);

CREATE TABLE device (
  id text PRIMARY KEY,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  outlet_id text NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
  device_type_id text NOT NULL REFERENCES device_type(id),
  model text NOT NULL,
  serial text NOT NULL UNIQUE,
  mac text NOT NULL UNIQUE,
  ip text NOT NULL,
  firmware text NOT NULL,
  status device_status NOT NULL DEFAULT 'online',
  last_push_at timestamptz NOT NULL,
  installed_at timestamptz NOT NULL,
  push_interval_sec int NOT NULL DEFAULT 300,
  ports jsonb NOT NULL,
  channels text[] NOT NULL DEFAULT '{app}',
  warranty_until timestamptz NOT NULL,
  last_maintenance_at timestamptz,
  next_maintenance_at timestamptz NOT NULL,
  uptime_pct double precision NOT NULL DEFAULT 100,
  sensor_faults int NOT NULL DEFAULT 0,
  floor_x double precision NOT NULL DEFAULT 50,
  floor_y double precision NOT NULL DEFAULT 50
);
CREATE INDEX device_tenant_status_idx ON device (distributor_id, status);
CREATE INDEX device_outlet_idx ON device (outlet_id);

CREATE TABLE sensor (
  id text PRIMARY KEY,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  device_id text NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  outlet_id text NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
  name text NOT NULL,
  type sensor_type NOT NULL,
  port_kind port_kind NOT NULL,
  port_index int NOT NULL,
  unit text NOT NULL,
  thresholds jsonb,
  enabled boolean NOT NULL DEFAULT true,
  floor_x double precision NOT NULL DEFAULT 50,
  floor_y double precision NOT NULL DEFAULT 50,
  -- One sensor per physical port. This is what actually guards the port map.
  UNIQUE (device_id, port_kind, port_index)
);
CREATE INDEX sensor_outlet_idx ON sensor (outlet_id);

CREATE TABLE reading (
  sensor_id text NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  at timestamptz NOT NULL,
  temperature_c double precision NOT NULL,
  humidity_pct double precision NOT NULL,
  PRIMARY KEY (sensor_id, at)
);
CREATE INDEX reading_at_idx ON reading (at);

CREATE TABLE employee (
  id text PRIMARY KEY,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  primary_outlet_id text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL UNIQUE,
  role employee_role NOT NULL,
  registration_token text,
  registration_status registration_status NOT NULL DEFAULT 'pending',
  registered_at timestamptz,
  approved_at timestamptz,
  avatar_color text NOT NULL
);

CREATE TABLE employee_outlet (
  employee_id text NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  outlet_id text NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, outlet_id)
);

CREATE TABLE technician (
  id text PRIMARY KEY,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  specialty text NOT NULL,
  avatar_color text NOT NULL,
  email text NOT NULL UNIQUE,
  registration_token text NOT NULL
);

CREATE TABLE contact_person (
  id text PRIMARY KEY,
  outlet_id text NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  role text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  channels channel[] NOT NULL DEFAULT '{app}'
);

CREATE TABLE alert (
  id bigserial PRIMARY KEY,
  external_alert_id text UNIQUE,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  outlet_id text NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
  device_id text NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  sensor_id text NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  sensor_name text NOT NULL,
  sensor_type sensor_type NOT NULL,
  category alert_category NOT NULL,
  status alert_status NOT NULL DEFAULT 'UNACKNOWLEDGED',
  trigger_value text NOT NULL,
  trigger_time timestamptz NOT NULL,
  clear_value text,
  clear_time timestamptz,
  message text NOT NULL,
  channels text[] NOT NULL DEFAULT '{app}',
  assignee_employee_id text,
  acknowledged_at timestamptz,
  responding_at timestamptz,
  resolved_at timestamptz,
  verified_at timestamptz
);
CREATE INDEX alert_tenant_status_time_idx ON alert (distributor_id, status, trigger_time DESC);
CREATE INDEX alert_sensor_status_idx ON alert (sensor_id, status);

CREATE TABLE alert_response (
  alert_id bigint PRIMARY KEY REFERENCES alert(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  notes text NOT NULL,
  photo_urls text[] NOT NULL DEFAULT '{}',
  responded_at timestamptz NOT NULL,
  response_duration_sec int NOT NULL
);

CREATE TABLE ticket (
  id text PRIMARY KEY,
  distributor_id text NOT NULL REFERENCES distributor(id) ON DELETE CASCADE,
  outlet_id text NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
  device_id text NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  sensor_id text,
  type maintenance_kind NOT NULL,
  priority ticket_priority NOT NULL,
  status ticket_status NOT NULL DEFAULT 'OPEN',
  title text NOT NULL,
  description text NOT NULL,
  technician_id text REFERENCES technician(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  completed_at timestamptz,
  parts_used text[] NOT NULL DEFAULT '{}',
  notes text,
  photo_urls text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX ticket_tenant_status_idx ON ticket (distributor_id, status);

-- Operators read ticket numbers out loud, so the MT-#### series is shared across the company
-- rather than restarting per distribution center.
CREATE SEQUENCE ticket_seq START 2601;

-- Feeds the Request log tab on the Integration page.
CREATE TABLE request_log (
  id text PRIMARY KEY,
  distributor_id text,
  at timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL,
  channel text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status int NOT NULL,
  ms int NOT NULL,
  summary text NOT NULL
);
CREATE INDEX request_log_at_idx ON request_log (at DESC);

-- Services write here inside their transaction; the dispatcher fans out afterwards.
CREATE TABLE outbox_event (
  id text PRIMARY KEY,
  name text NOT NULL,
  payload jsonb NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending_idx ON outbox_event (processed_at, at);

-- Inbound events that matched no device, listed on the Integration page for triage.
CREATE TABLE unmatched_event (
  id text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  reason text NOT NULL,
  raw text NOT NULL
);
