import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@kansride/db';
import { AdminService } from '../src/modules/admin/admin.service';
import { makeDbStub } from './helpers/drizzle-mock';

const DRIVER_ID = '00000000-0000-4000-8000-000000000010';
const DRIVER_USER_ID = '00000000-0000-4000-8000-000000000011';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000012';

function buildService(db = makeDbStub()) {
  const ridesService = {
    cancelRide: vi.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000013',
      status: 'cancelled_by_admin',
    }),
  };
  return {
    service: new AdminService(db as unknown as Database, ridesService as never),
    db,
    ridesService,
  };
}

describe('AdminService driver and user mutations', () => {
  it('approves a pending driver and writes an audit record in the transaction', async () => {
    const { service, db } = buildService();
    db.enqueue([{ id: DRIVER_ID, userId: DRIVER_USER_ID, isActive: false }]);
    db.enqueue([{ role: 'driver_applicant', status: 'active', isVerified: false }]);
    db.enqueue([]);
    db.enqueue([]);
    db.enqueue([]);

    await expect(service.approveDriver(DRIVER_ID, ADMIN_USER_ID)).resolves.toEqual({
      driverId: DRIVER_ID,
      status: 'approved',
    });
    db.assertDrained();
  });

  it('requires a reason before rejecting a pending driver', async () => {
    const { service, db } = buildService();
    await expect(service.rejectDriver(DRIVER_ID, ADMIN_USER_ID, '  ')).rejects.toThrow(
      /rejection reason is required/,
    );
    expect(db.pending()).toBe(0);
  });

  it('suspends a user and disables any driver profile in one transaction', async () => {
    const { service, db } = buildService();
    db.enqueue([{ id: DRIVER_USER_ID, status: 'active', role: 'driver' }]);
    db.enqueue([]);
    db.enqueue([]);
    db.enqueue([]);

    await expect(service.updateUserStatus(DRIVER_USER_ID, 'suspended', ADMIN_USER_ID)).resolves.toEqual({
      userId: DRIVER_USER_ID,
      status: 'suspended',
    });
    db.assertDrained();
  });

  it('delegates admin cancellation to the ride state machine and records an audit row', async () => {
    const { service, db, ridesService } = buildService();
    db.enqueue([]);

    const result = await service.cancelRide(
      '00000000-0000-4000-8000-000000000013',
      ADMIN_USER_ID,
      'ops_admin',
      'safety review',
    );

    expect(ridesService.cancelRide).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000013',
      ADMIN_USER_ID,
      'ops_admin',
      'safety review',
    );
    expect(result.status).toBe('cancelled_by_admin');
    db.assertDrained();
  });
});
