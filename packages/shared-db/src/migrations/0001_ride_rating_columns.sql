ALTER TABLE "rides" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "rating_comment" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "rated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "rated_by" uuid;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_rated_by_users_id_fk" FOREIGN KEY ("rated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
