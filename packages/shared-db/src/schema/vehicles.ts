import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

export const vehicleTypeEnum = pgEnum('vehicle_type', ['tricycle', 'motorcycle', 'car']);
export const vehicleStatusEnum = pgEnum('vehicle_status', ['active', 'inactive', 'suspended', 'decommissioned']);

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  registrationNumber: varchar('registration_number', { length: 20 }).unique().notNull(),
  type: vehicleTypeEnum('type').notNull().default('tricycle'),
  make: varchar('make', { length: 50 }),
  model: varchar('model', { length: 50 }),
  colour: varchar('colour', { length: 30 }).notNull(),
  year: integer('year'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  status: vehicleStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
