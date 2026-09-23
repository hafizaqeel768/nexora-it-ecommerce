-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "showInMenu" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "title" TEXT,
ADD COLUMN     "verifiedBuyer" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_customerId_key" ON "Review"("productId", "customerId");


-- Carry over what the home page tiles and menu showed (they read src/lib/site-nav.ts until Phase 12).
UPDATE "Category" SET "icon" = "slug"
WHERE "parentId" IS NULL AND "slug" IN ('computers', 'tablets', 'monitors', 'networking', 'power', 'iot', 'audio-conferencing');
UPDATE "Category" SET "description" = v.d
FROM (VALUES
  ('computers', 'Desktops, workstations and notebooks for every workload.'),
  ('tablets', 'Rugged and consumer tablets for field and office use.'),
  ('monitors', 'Displays from everyday 24" to ultrawide and 4K.'),
  ('networking', 'Switches, routers, access points and firewalls.'),
  ('power', 'Battery backup, meters and power protection.'),
  ('iot', 'Gateways, sensors and edge devices.'),
  ('audio-conferencing', 'Speakerphones, headsets and meeting-room audio.')
) AS v(slug, d)
WHERE "Category"."slug" = v.slug AND "Category"."description" IS NULL;
-- The home tiles showed six categories; Audio & Conferencing was only in the menu and footer.
