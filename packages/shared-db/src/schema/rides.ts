import { pgTable, uuid, varchar, text, integer, numeric, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { passengers } from './passengers';
import { drivers } from './drivers';

export const rideStatusEnum = pgEnum('ride_status', [
  'draft', 'requested', 'searching', 'driver_offered', 'driver_assigned',
  'driver_en_route', 'driver_arrived', 'waiting_for_passenger', 'passenger_verified',
  'in_progress', 'completed', 'cancelled_by_passenger', 'cancelled_by_driver',
  'cancelled_by_admin', 'no_driver_found', 'passenger_no_show', 'driver_no_show',
  'payment_pending', 'payment_failed', 'disputed', 'emergency_hold',
]);

export const rideTypeEnum = pgEnum('ride_type', ['standard_tricycle', 'priority_tricycle', 'shared', 'parcel_delivery']);

export const rides = pgTable('rides', {
  id: uuid('id').primaryKey().defaultRandom(),
  passengerId: uuid('passenger_id').notNull().references(() => passengers.id),
  driverId: uuid('driver_id').references(() => drivers.id),
  pickupLatitude: numeric('pickup_latitude', { precision: 10, scale: 8 }).notNull(),
  pickupLongitude: numeric('pickup_longitude', { precision: 11, scale: 8 }).notNull(),
  pickupAddress: text('pickup_address'),
  pickupLandmark: text('pickup_landmark'),
  dropoffLatitude: numeric('dropoff_latitude', { precision: 10, scale: 8 }).notNull(),
  dropoffLongitude: numeric('dropoff_longitude', { precision: 11, scale: 8 }).notNull(),
  dropoffAddress: text('dropoff_address'),
  dropoffLandmark: text('dropoff_landmark'),
  status: rideStatusEnum('status').notNull().default('draft'),
  rideType: rideTypeEnum('ride_type').notNull().default('standard_tricycle'),
  estimatedFarePesewas: integer('estimated_fare_pesewas').notNull(),
  actualFarePesewas: integer('actual_fare_pesewas'),
  estimatedDistanceMeters: integer('estimated_distance_meters'),
  estimatedDurationSeconds: integer('estimated_duration_seconds'),
  verificationPin: varchar('verification_pin', { length: 4 }),
  cancelledBy: uuid('cancelled_by'),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  ridesStatusIdx: index('idx_rides_status_created').on(table.status, table.createdAt),
  ridesPassengerIdx: index('idx_rides_passenger').on(table.passengerId, table.createdAt),
  ridesDriverIdx: index('idx_rides_driver').on(table.driverId, table.createdAt),
}));
