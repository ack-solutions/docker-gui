-- CreateTable
CREATE TABLE "database_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "passwordCipher" TEXT,
    "database" TEXT,
    "ssl" BOOLEAN NOT NULL DEFAULT false,
    "containerId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "database_connections_name_key" ON "database_connections"("name");
