import type { RideStatus } from '@kansride/types';

export interface RideTransition {
  nextStates: RideStatus[];
  allowedActors: string[];
}

/**
 * Defines all valid state transitions for the ride state machine.
 * Each entry maps a RideStatus to an array of possible transitions,
 * specifying which states it can move to and who can trigger the transition.
 */
export const VALID_RIDE_TRANSITIONS: Record<RideStatus, RideTransition[]> = {
  draft: [
    { nextStates: ['requested'], allowedActors: ['passenger'] },
  ],

  requested: [
    { nextStates: ['searching'], allowedActors: ['system'] },
    { nextStates: ['cancelled_by_passenger'], allowedActors: ['passenger'] },
  ],

  searching: [
    { nextStates: ['driver_offered'], allowedActors: ['system'] },
    { nextStates: ['no_driver_found'], allowedActors: ['system'] },
    { nextStates: ['cancelled_by_passenger'], allowedActors: ['passenger'] },
  ],

  driver_offered: [
    { nextStates: ['driver_assigned'], allowedActors: ['driver'] },
    { nextStates: ['searching'], allowedActors: ['system'] },
  ],

  driver_assigned: [
    { nextStates: ['driver_en_route'], allowedActors: ['driver'] },
    { nextStates: ['cancelled_by_passenger'], allowedActors: ['passenger'] },
    { nextStates: ['cancelled_by_driver'], allowedActors: ['driver'] },
    { nextStates: ['cancelled_by_admin'], allowedActors: ['admin'] },
  ],

  driver_en_route: [
    { nextStates: ['driver_arrived'], allowedActors: ['driver'] },
    { nextStates: ['cancelled_by_passenger'], allowedActors: ['passenger'] },
    { nextStates: ['cancelled_by_driver'], allowedActors: ['driver'] },
  ],

  driver_arrived: [
    { nextStates: ['waiting_for_passenger'], allowedActors: ['driver'] },
  ],

  waiting_for_passenger: [
    { nextStates: ['passenger_verified'], allowedActors: ['driver'] },
    { nextStates: ['passenger_no_show'], allowedActors: ['driver'] },
    { nextStates: ['cancelled_by_passenger'], allowedActors: ['passenger'] },
  ],

  passenger_verified: [
    { nextStates: ['in_progress'], allowedActors: ['driver'] },
  ],

  in_progress: [
    { nextStates: ['completed'], allowedActors: ['driver'] },
    { nextStates: ['emergency_hold'], allowedActors: ['system', 'passenger', 'driver'] },
  ],

  completed: [
    { nextStates: ['payment_pending'], allowedActors: ['system'] },
  ],

  payment_pending: [
    { nextStates: ['payment_failed'], allowedActors: ['system'] },
  ],

  emergency_hold: [
    { nextStates: ['in_progress'], allowedActors: ['admin'] },
    { nextStates: ['cancelled_by_admin'], allowedActors: ['admin'] },
  ],

  // Terminal states — no transitions out
  cancelled_by_passenger: [],
  cancelled_by_driver: [],
  cancelled_by_admin: [],
  no_driver_found: [],
  passenger_no_show: [],
  driver_no_show: [],
  payment_failed: [],
  disputed: [],
};
