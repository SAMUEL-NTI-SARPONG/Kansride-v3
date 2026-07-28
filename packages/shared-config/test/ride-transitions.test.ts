import { describe, it, expect } from 'vitest';
import { VALID_RIDE_TRANSITIONS } from '../src/ride-transitions';
import type { RideStatus } from '@kansride/types';

const ALL_RIDE_STATUSES: RideStatus[] = [
  'draft',
  'requested',
  'searching',
  'driver_offered',
  'driver_assigned',
  'driver_en_route',
  'driver_arrived',
  'waiting_for_passenger',
  'passenger_verified',
  'in_progress',
  'completed',
  'cancelled_by_passenger',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'no_driver_found',
  'passenger_no_show',
  'driver_no_show',
  'payment_pending',
  'payment_failed',
  'disputed',
  'emergency_hold',
];

const TERMINAL_STATUSES = new Set<RideStatus>([
  'cancelled_by_passenger',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'no_driver_found',
  'passenger_no_show',
  'driver_no_show',
  'payment_failed',
  'disputed',
]);

describe('VALID_RIDE_TRANSITIONS — structure invariants', () => {
  it('lists every canonical RideStatus exactly once', () => {
    expect(new Set(Object.keys(VALID_RIDE_TRANSITIONS))).toEqual(new Set(ALL_RIDE_STATUSES));
  });

  it('declares terminal states with no outbound transitions', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(VALID_RIDE_TRANSITIONS[status]).toEqual([]);
    }
  });

  it('declares every non-terminal state with at least one transition', () => {
    for (const status of ALL_RIDE_STATUSES) {
      if (TERMINAL_STATUSES.has(status)) continue;
      expect(VALID_RIDE_TRANSITIONS[status].length).toBeGreaterThan(0);
    }
  });

  it('only references canonical RideStatus values in nextStates', () => {
    const allowed = new Set<string>(ALL_RIDE_STATUSES);
    for (const [from, transitions] of Object.entries(VALID_RIDE_TRANSITIONS)) {
      for (const transition of transitions) {
        for (const next of transition.nextStates) {
          expect(allowed.has(next), `from "${from}" -> unknown "${next}"`).toBe(true);
        }
      }
    }
  });

  it('never re-enters the same state in a self-loop', () => {
    for (const [from, transitions] of Object.entries(VALID_RIDE_TRANSITIONS)) {
      for (const next of transitions.flatMap((t) => t.nextStates)) {
        expect(next, `self-loop at "${from}"`).not.toBe(from);
      }
    }
  });

  it('declares every transition with at least one allowed actor', () => {
    for (const transitions of Object.values(VALID_RIDE_TRANSITIONS)) {
      for (const transition of transitions) {
        expect(transition.allowedActors.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('VALID_RIDE_TRANSITIONS — main happy path', () => {
  function canTransition(from: RideStatus, to: RideStatus, actor: string): boolean {
    const transitions = VALID_RIDE_TRANSITIONS[from];
    return transitions.some((t) => t.nextStates.includes(to) && t.allowedActors.includes(actor));
  }

  it('draft → requested (passenger)', () => {
    expect(canTransition('draft', 'requested', 'passenger')).toBe(true);
  });

  it('requested → searching (system), requested → cancelled_by_passenger (passenger)', () => {
    expect(canTransition('requested', 'searching', 'system')).toBe(true);
    expect(canTransition('requested', 'cancelled_by_passenger', 'passenger')).toBe(true);
  });

  it('searching → driver_offered (system), searching → no_driver_found (system), searching → cancelled_by_passenger (passenger)', () => {
    expect(canTransition('searching', 'driver_offered', 'system')).toBe(true);
    expect(canTransition('searching', 'no_driver_found', 'system')).toBe(true);
    expect(canTransition('searching', 'cancelled_by_passenger', 'passenger')).toBe(true);
  });

  it('driver_offered → driver_assigned (driver), driver_offered → searching (system)', () => {
    expect(canTransition('driver_offered', 'driver_assigned', 'driver')).toBe(true);
    expect(canTransition('driver_offered', 'searching', 'system')).toBe(true);
  });

  it('driver_assigned → driver_en_route (driver) and cancellation roles', () => {
    expect(canTransition('driver_assigned', 'driver_en_route', 'driver')).toBe(true);
    expect(canTransition('driver_assigned', 'cancelled_by_passenger', 'passenger')).toBe(true);
    expect(canTransition('driver_assigned', 'cancelled_by_driver', 'driver')).toBe(true);
    expect(canTransition('driver_assigned', 'cancelled_by_admin', 'admin')).toBe(true);
  });

  it('progresses arrival → verification → in_progress → completed with the driver actor', () => {
    expect(canTransition('driver_en_route', 'driver_arrived', 'driver')).toBe(true);
    expect(canTransition('driver_arrived', 'waiting_for_passenger', 'driver')).toBe(true);
    expect(canTransition('waiting_for_passenger', 'passenger_verified', 'driver')).toBe(true);
    expect(canTransition('passenger_verified', 'in_progress', 'driver')).toBe(true);
    expect(canTransition('in_progress', 'completed', 'driver')).toBe(true);
  });

  it('lets driver move waiting_for_passenger to passenger_no_show but no other actor', () => {
    expect(canTransition('waiting_for_passenger', 'passenger_no_show', 'driver')).toBe(true);
    expect(canTransition('waiting_for_passenger', 'passenger_no_show', 'passenger')).toBe(false);
  });
});

describe('VALID_RIDE_TRANSITIONS — exception branches', () => {
  function actorsFor(from: RideStatus, to: RideStatus): string[] {
    const transitions = VALID_RIDE_TRANSITIONS[from];
    return transitions.filter((t) => t.nextStates.includes(to)).flatMap((t) => t.allowedActors);
  }

  it('in_progress → emergency_hold is reachable by system/passenger/driver', () => {
    const actors = actorsFor('in_progress', 'emergency_hold');
    expect(actors).toContain('system');
    expect(actors).toContain('passenger');
    expect(actors).toContain('driver');
  });

  it('emergency_hold → in_progress or cancelled_by_admin can only be lifted by admin', () => {
    expect(actorsFor('emergency_hold', 'in_progress')).toEqual(['admin']);
    expect(actorsFor('emergency_hold', 'cancelled_by_admin')).toEqual(['admin']);
  });

  it('completed → payment_pending (system) and payment_pending → payment_failed (system) stay system-only', () => {
    expect(actorsFor('completed', 'payment_pending')).toEqual(['system']);
    expect(actorsFor('payment_pending', 'payment_failed')).toEqual(['system']);
  });
});

describe('VALID_RIDE_TRANSITIONS — documented unreachable states', () => {
  it('driver_no_show has no inbound transition', () => {
    for (const status of Object.keys(VALID_RIDE_TRANSITIONS) as RideStatus[]) {
      for (const transition of VALID_RIDE_TRANSITIONS[status]) {
        expect(
          transition.nextStates,
          `inbound "driver_no_show" from "${status}"`,
        ).not.toContain('driver_no_show');
      }
    }
  });

  it('disputed has no inbound transition', () => {
    for (const status of Object.keys(VALID_RIDE_TRANSITIONS) as RideStatus[]) {
      for (const transition of VALID_RIDE_TRANSITIONS[status]) {
        expect(
          transition.nextStates,
          `inbound "disputed" from "${status}"`,
        ).not.toContain('disputed');
      }
    }
  });
});