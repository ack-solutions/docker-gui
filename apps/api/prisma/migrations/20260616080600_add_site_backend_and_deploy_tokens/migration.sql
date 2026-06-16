-- CreateTable
CREATE TABLE "deploy_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'static',
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deploy_tokens_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryDomain" TEXT NOT NULL,
    "aliasDomains" TEXT NOT NULL DEFAULT '[]',
    "backendType" TEXT NOT NULL DEFAULT 'external',
    "upstreamUrl" TEXT,
    "containerName" TEXT,
    "containerPort" INTEGER,
    "imageRef" TEXT,
    "envJson" TEXT,
    "spaFallback" BOOLEAN NOT NULL DEFAULT false,
    "currentDeployId" TEXT,
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
INSERT INTO "new_sites" ("aliasDomains", "createdAt", "dnsProviderId", "enableHttps", "enabled", "forceHttps", "id", "lastAppliedAt", "lastError", "letsEncryptEmail", "notes", "primaryDomain", "status", "updatedAt", "upstreamUrl") SELECT "aliasDomains", "createdAt", "dnsProviderId", "enableHttps", "enabled", "forceHttps", "id", "lastAppliedAt", "lastError", "letsEncryptEmail", "notes", "primaryDomain", "status", "updatedAt", "upstreamUrl" FROM "sites";
DROP TABLE "sites";
ALTER TABLE "new_sites" RENAME TO "sites";
CREATE UNIQUE INDEX "sites_primaryDomain_key" ON "sites"("primaryDomain");
CREATE INDEX "sites_dnsProviderId_idx" ON "sites"("dnsProviderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "deploy_tokens_tokenHash_key" ON "deploy_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "deploy_tokens_siteId_idx" ON "deploy_tokens"("siteId");
