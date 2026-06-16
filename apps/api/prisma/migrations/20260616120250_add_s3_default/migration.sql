-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_s3_connections" (
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
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultBucket" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_s3_connections" ("accessKey", "createdAt", "endpoint", "flavor", "id", "lastError", "lastVerifiedAt", "name", "pathStyle", "region", "secretKeyCipher", "updatedAt", "verified") SELECT "accessKey", "createdAt", "endpoint", "flavor", "id", "lastError", "lastVerifiedAt", "name", "pathStyle", "region", "secretKeyCipher", "updatedAt", "verified" FROM "s3_connections";
DROP TABLE "s3_connections";
ALTER TABLE "new_s3_connections" RENAME TO "s3_connections";
CREATE UNIQUE INDEX "s3_connections_name_key" ON "s3_connections"("name");
CREATE INDEX "s3_connections_isDefault_idx" ON "s3_connections"("isDefault");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
