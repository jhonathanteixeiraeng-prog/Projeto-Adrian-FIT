-- Usage limits (audit A10): fixed-window counters per operation and caller, keyed by a hash (no e-mail
-- or IP address stored). A new table: nothing existing changes.
CREATE TABLE IF NOT EXISTS "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
