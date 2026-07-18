import { pgTable, uuid, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { drivers } from './drivers';

export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'expired', 'pending', 'cancelled']);

export const subscriptions = pgTable('driver_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  amountPesewas: integer('amount_pesewas').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: subscriptionStatusEnum('status').notNull().default('pending'),
  paymentId: uuid('payment_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  subsDriverExpiryIdx: index('idx_subs_driver_expiry').on(table.driverId, table.endDate),
}));
