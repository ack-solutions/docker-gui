-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_database_connections" (
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
    "backupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupCron" TEXT,
    "backupS3ConnectionId" TEXT,
    "backupBucket" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_database_connections" ("containerId", "createdAt", "database", "engine", "host", "id", "lastError", "lastVerifiedAt", "name", "passwordCipher", "port", "ssl", "updatedAt", "username", "verified") SELECT "containerId", "createdAt", "database", "engine", "host", "id", "lastError", "lastVerifiedAt", "name", "passwordCipher", "port", "ssl", "updatedAt", "username", "verified" FROM "database_connections";
DROP TABLE "database_connections";
ALTER TABLE "new_database_connections" RENAME TO "database_connections";
CREATE UNIQUE INDEX "database_connections_name_key" ON "database_connections"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
