-- AKCP sensorProbe+ units address each sensor by a compound id such as 0.1.0.5.0, which the
-- unit publishes in the MQTT topic. external_key holds that id, so an installer can bind a
-- port on the unit to the sensor row an admin already created.
--
-- The column stays empty for Room Alert units: they reach us over the webhook, which matches
-- by serial and sensor name. When it is empty the MQTT path falls back to the compound id
-- registry in internal/akcp, which knows the temperature and humidity keys the units ship with.

ALTER TABLE sensor ADD COLUMN external_key text;

CREATE UNIQUE INDEX sensor_external_key_idx ON sensor (device_id, external_key)
  WHERE external_key IS NOT NULL;
