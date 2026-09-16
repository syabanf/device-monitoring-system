import type { SessionClaims } from '@monitoring/contracts';
import type { Db } from '../../db/client';
import { unauthorized } from '../../lib/errors';
import { verifyPassword } from '../../lib/password';

export interface Principal {
  claims: SessionClaims;
  name: string;
  email: string;
  ttlSec: number;
}

/** Admins use a password. The dashboard is the only client that needs one. */
export async function adminLogin(db: Db, email: string, password: string, ttlSec: number): Promise<Principal> {
  const admin = await db.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) throw unauthorized('Email or password is wrong');
  return {
    claims: { sub: admin.id, kind: 'admin', distributorId: admin.distributorId, role: admin.role },
    name: admin.name,
    email: admin.email,
    ttlSec,
  };
}

/**
 * Employees and technicians exchange the token their admin issued. Employees are scoped to
 * their outlets; a technician covers the whole distribution center.
 */
export async function tokenLogin(db: Db, email: string, token: string, ttlSec: number): Promise<Principal> {
  const lower = email.toLowerCase();
  const employee = await db.employee.findUnique({ where: { email: lower }, include: { outlets: { select: { id: true } } } });
  if (employee) {
    if (employee.registrationToken !== token) throw unauthorized('Token does not match this account');
    if (employee.registrationStatus !== 'approved') throw unauthorized('Registration is still awaiting admin approval');
    return {
      claims: { sub: employee.id, kind: 'employee', distributorId: employee.distributorId, outletIds: employee.outlets.map((o) => o.id), role: employee.role },
      name: employee.name,
      email: employee.email,
      ttlSec,
    };
  }
  const technician = await db.technician.findUnique({ where: { email: lower } });
  if (!technician || technician.registrationToken !== token) throw unauthorized('Email or token is wrong');
  return {
    claims: { sub: technician.id, kind: 'technician', distributorId: technician.distributorId, role: 'technician' },
    name: technician.name,
    email: technician.email,
    ttlSec,
  };
}
