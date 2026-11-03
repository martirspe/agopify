-- New businesses start a 7-day Crece trial (was 14). Existing planExpiresAt values are unchanged.
ALTER TABLE "Tenant" ALTER COLUMN "planExpiresAt" SET DEFAULT (now() + '7 days'::interval);
