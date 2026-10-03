-- Refuse existing duplicates rather than silently cancelling any live trips.
-- Resolve any conflicting trips through normal operations before retrying.
CREATE UNIQUE INDEX "idx_rides_one_active_passenger" ON "rides" ("passenger_id")
WHERE "status" IN ('requested', 'searching', 'driver_offered', 'driver_assigned',
  'driver_en_route', 'driver_arrived', 'waiting_for_passenger', 'passenger_verified',
  'in_progress', 'emergency_hold');
