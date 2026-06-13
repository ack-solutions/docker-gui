-- CreateTable
CREATE TABLE "registry_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "managed" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "passwordCipher" TEXT,
    "pushHost" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "registry_connections_name_key" ON "registry_connections"("name");
