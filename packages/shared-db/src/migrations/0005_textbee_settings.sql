CREATE TABLE "app_settings" (
  "key" varchar(100) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
