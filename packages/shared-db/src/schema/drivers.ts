import { pgTable, uuid, varchar, numeric, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { vehicles } from './vehicles';

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
  licenseNumber: varchar('license_number', { length: 50 }).unique().notNull(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('5.00'),
  isOnline: boolean('is_online').notNull().default(false),
  isActive: boolean('is_active').notNull().default(false),
  currentLatitude: numeric('current_latitude', { precision: 10, scale: 8 }),
  currentLongitude: numeric('current_longitude', { precision: 11, scale: 8 }),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  completedRides: integer('completed_rides').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  driversOnlineIdx: index('idx_drivers_online_location').on(table.isOnline, table.currentLatitude, table.currentLongitude),
}));
