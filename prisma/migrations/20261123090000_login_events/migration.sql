-- Sign-in attempts, kept 90 days (src/lib/login-events.ts).
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "emailHash" TEXT,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_events_createdAt_idx" ON "login_events"("createdAt");
CREATE INDEX "login_events_userId_createdAt_idx" ON "login_events"("userId", "createdAt");

ALTER TABLE "login_events" ADD CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
