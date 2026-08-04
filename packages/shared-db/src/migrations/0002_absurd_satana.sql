DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_driver_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."driver_subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_subscriptions" ADD CONSTRAINT "driver_subscriptions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_payments_provider_reference" ON "payments" USING btree ("provider_reference");