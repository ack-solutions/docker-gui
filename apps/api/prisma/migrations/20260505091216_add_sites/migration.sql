-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryDomain" TEXT NOT NULL,
    "aliasDomains" TEXT NOT NULL DEFAULT '[]',
    "upstreamUrl" TEXT NOT NULL,
    "enableHttps" BOOLEAN NOT NULL DEFAULT true,
    "forceHttps" BOOLEAN NOT NULL DEFAULT true,
    "letsEncryptEmail" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastError" TEXT,
    "lastAppliedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_primaryDomain_key" ON "sites"("primaryDomain");
