-- Refuse conflicting assignments; never cancel existing trips automatically.
CREATE UNIQUE INDEX "idx_rides_one_active_driver" ON "rides" ("driver_id")
WHERE "driver_id" IS NOT NULL AND "status" IN ('driver_assigned', 'driver_en_route',
  'driver_arrived', 'waiting_for_passenger', 'passenger_verified', 'in_progress', 'emergency_hold');
