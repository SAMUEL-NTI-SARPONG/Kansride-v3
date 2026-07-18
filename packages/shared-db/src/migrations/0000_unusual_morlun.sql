CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('passenger', 'driver_applicant', 'driver', 'dispatcher', 'support_agent', 'finance_officer', 'safety_officer', 'ops_admin', 'system_admin', 'super_admin', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'inactive', 'suspended', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('tricycle', 'motorcycle', 'car');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('draft', 'requested', 'searching', 'driver_offered', 'driver_assigned', 'driver_en_route', 'driver_arrived', 'waiting_for_passenger', 'passenger_verified', 'in_progress', 'completed', 'cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_admin', 'no_driver_found', 'passenger_no_show', 'driver_no_show', 'payment_pending', 'payment_failed', 'disputed', 'emergency_hold');--> statement-breakpoint
CREATE TYPE "public"."ride_type" AS ENUM('standard_tricycle', 'priority_tricycle', 'shared', 'parcel_delivery');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'mtn_mobile_money', 'telecel_cash', 'at_money', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'pending', 'authorized', 'successful', 'failed', 'cancelled', 'expired', 'reversed', 'refunded', 'partially_refunded', 'under_review');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('ride_fare', 'subscription', 'refund', 'wallet_topup');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'pending', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"changes" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"license_number" varchar(50) NOT NULL,
	"vehicle_id" uuid,
	"rating" numeric(3, 2) DEFAULT '5.00' NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"current_latitude" numeric(10, 8),
	"current_longitude" numeric(11, 8),
	"subscription_expires_at" timestamp with time zone,
	"completed_rides" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "drivers_license_number_unique" UNIQUE("license_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"email" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"role" "user_role" DEFAULT 'passenger' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"profile_photo_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_number" varchar(20) NOT NULL,
	"type" "vehicle_type" DEFAULT 'tricycle' NOT NULL,
	"make" varchar(50),
	"model" varchar(50),
	"colour" varchar(30) NOT NULL,
	"year" integer,
	"owner_id" uuid NOT NULL,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_registration_number_unique" UNIQUE("registration_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "passengers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" numeric(3, 2) DEFAULT '5.00' NOT NULL,
	"preferred_payment_method" varchar(30) DEFAULT 'cash' NOT NULL,
	"completed_rides" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passengers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passenger_id" uuid NOT NULL,
	"driver_id" uuid,
	"pickup_latitude" numeric(10, 8) NOT NULL,
	"pickup_longitude" numeric(11, 8) NOT NULL,
	"pickup_address" text,
	"pickup_landmark" text,
	"dropoff_latitude" numeric(10, 8) NOT NULL,
	"dropoff_longitude" numeric(11, 8) NOT NULL,
	"dropoff_address" text,
	"dropoff_landmark" text,
	"status" "ride_status" DEFAULT 'draft' NOT NULL,
	"ride_type" "ride_type" DEFAULT 'standard_tricycle' NOT NULL,
	"estimated_fare_pesewas" integer NOT NULL,
	"actual_fare_pesewas" integer,
	"estimated_distance_meters" integer,
	"estimated_duration_seconds" integer,
	"verification_pin" varchar(4),
	"cancelled_by" uuid,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ride_id" uuid,
	"subscription_id" uuid,
	"user_id" uuid NOT NULL,
	"type" "payment_type" NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"provider_reference" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"code_hash" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "passengers" ADD CONSTRAINT "passengers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_passenger_id_passengers_id_fk" FOREIGN KEY ("passenger_id") REFERENCES "public"."passengers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_subscriptions" ADD CONSTRAINT "driver_subscriptions_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_drivers_online_location" ON "drivers" USING btree ("is_online","current_latitude","current_longitude");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rides_status_created" ON "rides" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rides_passenger" ON "rides" USING btree ("passenger_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rides_driver" ON "rides" USING btree ("driver_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subs_driver_expiry" ON "driver_subscriptions" USING btree ("driver_id","end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otp_phone_expiry" ON "otp_requests" USING btree ("phone_number","expires_at");