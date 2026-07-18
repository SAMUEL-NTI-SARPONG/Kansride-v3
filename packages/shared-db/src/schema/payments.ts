import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { rides } from './rides';

export const paymentStatusEnum = pgEnum('payment_status', [
  'created', 'pending', 'authorized', 'successful', 'failed',
  'cancelled', 'expired', 'reversed', 'refunded', 'partially_refunded', 'under_review',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash', 'mtn_mobile_money', 'telecel_cash', 'at_money', 'wallet',
]);

export const paymentTypeEnum = pgEnum('payment_type', [
  'ride_fare', 'subscription', 'refund', 'wallet_topup',
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  rideId: uuid('ride_id').references(() => rides.id),
  subscriptionId: uuid('subscription_id'),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: paymentTypeEnum('type').notNull(),
  amountPesewas: integer('amount_pesewas').notNull(),
  method: paymentMethodEnum('method').notNull(),
  status: paymentStatusEnum('status').notNull().default('created'),
  providerReference: varchar('provider_reference', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
