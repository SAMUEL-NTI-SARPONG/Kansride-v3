import { pgTable, uuid, varchar, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const passengers = pgTable('passengers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('5.00'),
  preferredPaymentMethod: varchar('preferred_payment_method', { length: 30 }).notNull().default('cash'),
  completedRides: integer('completed_rides').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
