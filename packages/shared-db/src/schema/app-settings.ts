import { pgTable, varchar, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
