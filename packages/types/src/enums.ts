export type SensorType =
  | 'TEMPERATURE'
  | 'TEMPERATURE_HUMIDITY'
  | 'DOOR'
  | 'MOTION'
  | 'POWER'
  | 'PANIC_BUTTON';

export type PortKind = 'digital' | 'switch' | 'analog';
export type DeviceModel = 'RA3S' | 'RA12S';
export type DeviceStatus = 'online' | 'offline';
export type AlertStatus = 'UNACKNOWLEDGED' | 'ACKNOWLEDGED' | 'RESPONDING' | 'RESOLVED' | 'VERIFIED';
export type AlertCategory = 'COMFORT' | 'SECURITY';
export type RegistrationStatus = 'pending' | 'approved';
export type EmployeeRole = 'store_manager' | 'assistant_manager' | 'cashier' | 'staff';
export type Channel = 'app' | 'telegram';

export const SENSOR_TYPE_LABEL: Record<SensorType, string> = {
  TEMPERATURE: 'Temperature',
  TEMPERATURE_HUMIDITY: 'Temperature & Humidity',
  DOOR: 'Door Switch',
  MOTION: 'Motion Detector',
  POWER: 'Power Sensor',
  PANIC_BUTTON: 'Panic Button',
};

/**
 * The sensor types this deployment installs today. Door, motion, power and panic sensors stay in
 * the model so existing installations keep reading and reporting, and the pickers refuse to add
 * new ones until the rollout covers them.
 */
export const ENABLED_SENSOR_TYPES: SensorType[] = ['TEMPERATURE', 'TEMPERATURE_HUMIDITY'];

export const isSensorTypeEnabled = (type: SensorType): boolean => ENABLED_SENSOR_TYPES.includes(type);

/** What a state sensor reports when it is quiet and when it fires. */
export const SENSOR_STATE_LABEL: Partial<Record<SensorType, { normal: string; alarm: string }>> = {
  DOOR: { normal: 'Closed', alarm: 'Open' },
  MOTION: { normal: 'Clear', alarm: 'Motion' },
  POWER: { normal: 'Power OK', alarm: 'Power lost' },
  PANIC_BUTTON: { normal: 'Idle', alarm: 'Pressed' },
};

export const EMPLOYEE_ROLE_LABEL: Record<EmployeeRole, string> = {
  store_manager: 'Store Manager',
  assistant_manager: 'Assistant Manager',
  cashier: 'Cashier',
  staff: 'Staff',
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  UNACKNOWLEDGED: 'Unacknowledged',
  ACKNOWLEDGED: 'Acknowledged',
  RESPONDING: 'Responding',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
};

export const ALERT_CATEGORY_LABEL: Record<AlertCategory, string> = {
  COMFORT: 'Shopping Comfort',
  SECURITY: 'Outlet Security',
};

export type HealthStatus = 'healthy' | 'attention' | 'critical';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'REPLACEMENT' | 'INSTALLATION' | 'FIRMWARE';
export type TicketStatus = 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'DONE';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const MAINTENANCE_TYPE_LABEL: Record<MaintenanceType, string> = {
  PREVENTIVE: 'Preventive check',
  CORRECTIVE: 'Corrective repair',
  REPLACEMENT: 'Part replacement',
  INSTALLATION: 'Installation',
  FIRMWARE: 'Firmware update',
};
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};
export const HEALTH_LABEL: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  attention: 'Needs attention',
  critical: 'Critical',
};
