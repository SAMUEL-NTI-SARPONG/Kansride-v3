ALTER TABLE "users" ADD COLUMN "pin_hash" text;
ALTER TABLE "users" ADD COLUMN "community_id" varchar(80);
ALTER TABLE "users" ALTER COLUMN "profile_photo_url" SET DATA TYPE text;
ALTER TABLE "drivers" ADD COLUMN "ghana_card_number" varchar(30);
ALTER TABLE "drivers" ADD COLUMN "place_of_stay" varchar(160);
ALTER TABLE "drivers" ADD COLUMN "community_id" varchar(80);
ALTER TABLE "drivers" ADD COLUMN "emergency_contact_name" varchar(160);
ALTER TABLE "drivers" ADD COLUMN "emergency_phone_number" varchar(20);
CREATE UNIQUE INDEX "drivers_ghana_card_number_unique" ON "drivers" ("ghana_card_number") WHERE "ghana_card_number" IS NOT NULL;
