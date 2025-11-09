-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cpu_metrics_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "usagePercent" REAL NOT NULL,
    "loadAverage1m" REAL NOT NULL,
    "loadAverage5m" REAL NOT NULL,
    "loadAverage15m" REAL NOT NULL,
    "coresUsage" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "memory_metrics_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "usagePercent" REAL NOT NULL,
    "usedBytes" BIGINT NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "freeBytes" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "disk_metrics_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "usagePercent" REAL NOT NULL,
    "usedBytes" BIGINT NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "availableBytes" BIGINT NOT NULL,
    "partitions" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "nginx_sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryDomain" TEXT NOT NULL,
    "serverNames" JSONB NOT NULL,
    "upstreamType" TEXT NOT NULL,
    "upstreamTarget" TEXT NOT NULL,
    "containerId" TEXT,
    "containerPort" INTEGER,
    "enableHttp" BOOLEAN NOT NULL DEFAULT true,
    "enableHttps" BOOLEAN NOT NULL DEFAULT true,
    "forceHttps" BOOLEAN NOT NULL DEFAULT false,
    "sslMode" TEXT NOT NULL DEFAULT 'lets-encrypt',
    "letsEncryptEmail" TEXT,
    "sslCertificateId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastError" TEXT,
    "lastAppliedAt" DATETIME,
    "lastValidatedAt" DATETIME,
    "configPath" TEXT,
    "notes" TEXT,
    "extraDirectives" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "nginx_provision_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nginx_provision_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "nginx_sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mode" TEXT NOT NULL DEFAULT 'managed',
    "dnsProviderType" TEXT,
    "dnsProviderConfig" JSONB,
    "parentDomainId" TEXT,
    "notes" TEXT,
    "targetType" TEXT NOT NULL DEFAULT 'none',
    "targetContainerId" TEXT,
    "targetContainerPort" INTEGER,
    "targetServiceHost" TEXT,
    "targetExternalUrl" TEXT,
    "targetStaticRoot" TEXT,
    "enableHttp" BOOLEAN NOT NULL DEFAULT true,
    "enableHttps" BOOLEAN NOT NULL DEFAULT true,
    "forceHttps" BOOLEAN NOT NULL DEFAULT false,
    "sslMode" TEXT NOT NULL DEFAULT 'lets-encrypt',
    "letsEncryptEmail" TEXT,
    "sslCertificateId" TEXT,
    "nginxSiteId" TEXT,
    "lastError" TEXT,
    "customNginxConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "domains_parentDomainId_fkey" FOREIGN KEY ("parentDomainId") REFERENCES "domains" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "domains_nginxSiteId_fkey" FOREIGN KEY ("nginxSiteId") REFERENCES "nginx_sites" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "domain_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "ttl" INTEGER NOT NULL DEFAULT 300,
    "priority" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "domain_records_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_cpu_timestamp" ON "cpu_metrics_logs"("timestamp");

-- CreateIndex
CREATE INDEX "idx_memory_timestamp" ON "memory_metrics_logs"("timestamp");

-- CreateIndex
CREATE INDEX "idx_disk_timestamp" ON "disk_metrics_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "nginx_sites_primaryDomain_key" ON "nginx_sites"("primaryDomain");

-- CreateIndex
CREATE INDEX "idx_nginx_provision_site" ON "nginx_provision_logs"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- CreateIndex
CREATE INDEX "idx_domain_parent" ON "domains"("parentDomainId");

-- CreateIndex
CREATE INDEX "idx_domain_record_domain" ON "domain_records"("domainId");
