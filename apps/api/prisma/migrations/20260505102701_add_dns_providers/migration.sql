-- CreateTable
CREATE TABLE "dns_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "credentialsCipher" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sites" (
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
    "dnsProviderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sites_dnsProviderId_fkey" FOREIGN KEY ("dnsProviderId") REFERENCES "dns_providers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sites" ("aliasDomains", "createdAt", "enableHttps", "enabled", "forceHttps", "id", "lastAppliedAt", "lastError", "letsEncryptEmail", "notes", "primaryDomain", "status", "updatedAt", "upstreamUrl") SELECT "aliasDomains", "createdAt", "enableHttps", "enabled", "forceHttps", "id", "lastAppliedAt", "lastError", "letsEncryptEmail", "notes", "primaryDomain", "status", "updatedAt", "upstreamUrl" FROM "sites";
DROP TABLE "sites";
ALTER TABLE "new_sites" RENAME TO "sites";
CREATE UNIQUE INDEX "sites_primaryDomain_key" ON "sites"("primaryDomain");
CREATE INDEX "sites_dnsProviderId_idx" ON "sites"("dnsProviderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "dns_providers_name_key" ON "dns_providers"("name");
