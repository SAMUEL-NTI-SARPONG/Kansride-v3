import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const otpRequests = pgTable('otp_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  codeHash: varchar('code_hash', { length: 255 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
