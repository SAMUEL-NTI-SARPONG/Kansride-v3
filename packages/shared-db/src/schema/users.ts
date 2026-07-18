import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'passenger', 'driver_applicant', 'driver', 'dispatcher', 'support_agent',
  'finance_officer', 'safety_officer', 'ops_admin', 'system_admin', 'super_admin', 'auditor',
]);

export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended', 'banned']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number', { length: 20 }).unique().notNull(),
  email: varchar('email', { length: 255 }),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  role: userRoleEnum('role').notNull().default('passenger'),
  status: userStatusEnum('status').notNull().default('active'),
  isVerified: boolean('is_verified').notNull().default(false),
  profilePhotoUrl: varchar('profile_photo_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
