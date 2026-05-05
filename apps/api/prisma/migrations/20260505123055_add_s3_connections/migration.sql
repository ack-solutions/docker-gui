-- CreateTable
CREATE TABLE "s3_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "flavor" TEXT NOT NULL DEFAULT 'auto',
    "pathStyle" BOOLEAN NOT NULL DEFAULT true,
    "accessKey" TEXT NOT NULL,
    "secretKeyCipher" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "s3_connections_name_key" ON "s3_connections"("name");
