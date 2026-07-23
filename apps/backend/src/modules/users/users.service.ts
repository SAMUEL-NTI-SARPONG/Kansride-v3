import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { Database, users, passengers, drivers, rides } from '@kansride/db';
import { eq, and, count } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  /**
   * Return the authenticated user's profile.
   *
   * Identity flow: `req.user.userId == users.id` (validated by AuthGuard).
   * We fetch the `users` row, then resolve the passenger profile (if any)
   * by `passengers.userId = users.id`, and the driver profile (if any) by
   * `drivers.userId = users.id`. The response carries explicit
   * `isPassenger` / `isDriver` flags so callers can decide whether to
   * hit `/drivers/me` (or a future passenger profile endpoint) for full
   * domain details.
   *
   * `totalRides` for a passenger is computed as a live `COUNT(*)` of
   * completed rides for that passenger (`rides.passengerId =
   * passengers.id AND rides.status = 'completed'`). The
   * `passengers.completedRides` column exists but is not maintained by
   * any code path (no increment on ride completion), so it is not
   * authoritative; the live count is. See requirement #6.
   *
   * A user with neither a passenger nor a driver profile (e.g.
   * `dispatcher`, `auditor`, an un-approved `driver_applicant`) is
   * returned with both flags false and `totalRides: 0`. No profile row
   * is created by this endpoint.
   *
   * Sensitive fields (OTP codes/expiry/attempts, internal timestamps used
   * only for audit, etc.) are not part of the `users` table and therefore
   * cannot leak here; see "Sensitive-field exclusions" in the recovery
   * log for the full exclusion list.
   */
  async getProfile(authenticatedUserId: string) {
    // Q1: base user row. Throws NotFoundException if the JWT's userId no
    // longer matches a users row (e.g. row was deleted after token
    // issuance).
    const userRecords = await this.db
      .select()
      .from(users)
      .where(eq(users.id, authenticatedUserId))
      .limit(1);
    const user = userRecords[0];
    if (!user) {
      throw new NotFoundException(`User not found for id ${authenticatedUserId}`);
    }

    // Q2 + Q3 + Q4 run independently and in parallel to keep this
    // endpoint at a fixed cost (a handful of single-row queries, no
    // N+1).
    const [passengerRideCount, passengerRow, driverRow] = await Promise.all([
      // Q2: passenger total completed rides via a join (single row,
      // aggregate). Returns 0 when the user has no passenger row or when
      // the passenger has no completed rides. Drizzle's `count()` yields a
      // string|null; we coerce with `Number(...) || 0`.
      this.db
        .select({ total: count() })
        .from(rides)
        .innerJoin(passengers, eq(passengers.id, rides.passengerId))
        .where(and(
          eq(passengers.userId, authenticatedUserId),
          eq(rides.status, 'completed'),
        ))
        .then((rows) => {
          const raw = rows[0]?.total;
          const value = raw === null || raw === undefined ? 0 : Number(raw);
          return Number.isFinite(value) ? value : 0;
        }),
      // Q3: passenger profile existence. Only `id` is selected; no
      // passenger detail is returned by `/users/me`. If the user has a
      // passenger row with zero completed rides, this still returns a row
      // (and isPassenger = true), while Q2 returns 0.
      this.db
        .select({ id: passengers.id })
        .from(passengers)
        .where(eq(passengers.userId, authenticatedUserId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      // Q4: driver profile existence + id, used only to set `isDriver`.
      // Driver details belong to `GET /drivers/me`.
      this.db
        .select({ id: drivers.id })
        .from(drivers)
        .where(eq(drivers.userId, authenticatedUserId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    const isPassenger = passengerRow !== null;
    const isDriver = driverRow !== null;
    const totalRides = isPassenger ? passengerRideCount : 0;

    const name = [user.firstName, user.lastName]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ');

    return {
      // Base user fields
      id: user.id,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      name: name.length > 0 ? name : undefined,
      phone: user.phoneNumber,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      profilePhotoUrl: user.profilePhotoUrl,
      createdAt: user.createdAt,
      // Profile flags + ride count for callers
      isPassenger,
      isDriver,
      totalRides,
    };
  }
}
