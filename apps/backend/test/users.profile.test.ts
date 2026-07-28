import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import { UsersService } from '../src/modules/users/users.service';
import { makeDbStub } from './helpers/drizzle-mock';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PASSENGER_PROFILE_ID = '00000000-0000-4000-8000-000000000002';
const DRIVER_PROFILE_ID = '00000000-0000-4000-8000-000000000003';

function buildService(db = makeDbStub()) {
  const service = new UsersService(db as unknown as Database);
  return { service, db };
}

describe('UsersService.getProfile — identity mapping', () => {
  it('throws NotFoundException when the JWT userId does not correspond to a users row', async () => {
    const { service, db } = buildService();
    db.enqueue([]); // SELECT * FROM users WHERE id = jwt.userId
    await expect(service.getProfile(USER_ID)).rejects.toThrow(NotFoundException);
    // Profile lookups are never attempted when the base users row is missing.
    expect(db.pending()).toBe(0);
  });

  it('resolves passenger and driver flags by passengers.userId / drivers.userId, not via injected profile ids', async () => {
    const { service, db } = buildService();
    db.enqueue([{
      id: USER_ID,
      phoneNumber: '+233244000001',
      firstName: 'Ama',
      lastName: 'Boateng',
      email: null,
      role: 'passenger',
      status: 'active',
      isVerified: true,
      profilePhotoUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }]);
    db.enqueue([{ total: '5' }]); // count(*) of completed rides for passengers.userId = USER_ID
    db.enqueue([{ id: PASSENGER_PROFILE_ID }]); // passenger profile by userId lookup
    db.enqueue([{ id: DRIVER_PROFILE_ID }]); // driver profile by userId lookup

    const profile = await service.getProfile(USER_ID);
    db.assertDrained();
    expect(profile).toMatchObject({
      id: USER_ID,
      isPassenger: true,
      isDriver: true,
      role: 'passenger',
      totalRides: 5,
      // `phone` and `phoneNumber` reflect the same users-row value verbatim.
      phone: '+233244000001',
      phoneNumber: '+233244000001',
      // `name` is composed at the boundary, not stored as a column.
      name: 'Ama Boateng',
    });
  });

  it('returns totalRides=0 with both flags false when the user has neither profile', async () => {
    const { service, db } = buildService();
    db.enqueue([{
      id: USER_ID,
      phoneNumber: '+233244000002',
      firstName: null,
      lastName: null,
      email: null,
      role: 'dispatcher',
      status: 'active',
      isVerified: false,
      profilePhotoUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }]);
    db.enqueue([{ total: null }]); // COUNT(*) returns null for a join-less query path
    db.enqueue([]); // no passenger profile
    db.enqueue([]); // no driver profile
    const profile = await service.getProfile(USER_ID);
    db.assertDrained();
    expect(profile).toMatchObject({
      id: USER_ID,
      isPassenger: false,
      isDriver: false,
      totalRides: 0,
      name: undefined,
    });
  });

  it('reports totalRides as a finite integer regardless of COUNT returning string/null/non-finite', async () => {
    const cases: Array<{ input: unknown; expected: number }> = [
      { input: '12', expected: 12 },
      { input: '0', expected: 0 },
      { input: null, expected: 0 },
      { input: undefined, expected: 0 },
      { input: 'NaN-string', expected: 0 },
      { input: '1234567890', expected: 1_234_567_890 },
    ];
    for (const { input, expected } of cases) {
      const { service, db } = buildService();
      db.enqueue([{
        id: USER_ID,
        phoneNumber: '+233244000003',
        firstName: 'Kwame',
        lastName: null,
        email: null,
        role: 'passenger',
        status: 'active',
        isVerified: true,
        profilePhotoUrl: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }]);
      db.enqueue([{ total: input }]);
      db.enqueue([{ id: PASSENGER_PROFILE_ID }]);
      db.enqueue([]);
      const profile = await service.getProfile(USER_ID);
      expect(profile.totalRides).toBe(expected);
      expect(Number.isFinite(profile.totalRides)).toBe(true);
    }
  });
});