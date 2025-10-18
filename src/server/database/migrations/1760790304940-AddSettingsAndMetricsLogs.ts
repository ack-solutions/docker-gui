import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSettingsAndMetricsLogs1760790304940 implements MigrationInterface {
    name = 'AddSettingsAndMetricsLogs1760790304940'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cpu_metrics_logs" ("id" varchar PRIMARY KEY NOT NULL, "timestamp" datetime NOT NULL, "usagePercent" real NOT NULL, "loadAverage1m" real NOT NULL, "loadAverage5m" real NOT NULL, "loadAverage15m" real NOT NULL, "coresUsage" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE INDEX "idx_cpu_timestamp" ON "cpu_metrics_logs" ("timestamp") `);
        await queryRunner.query(`CREATE TABLE "memory_metrics_logs" ("id" varchar PRIMARY KEY NOT NULL, "timestamp" datetime NOT NULL, "usagePercent" real NOT NULL, "usedBytes" integer NOT NULL, "totalBytes" integer NOT NULL, "freeBytes" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE INDEX "idx_memory_timestamp" ON "memory_metrics_logs" ("timestamp") `);
        await queryRunner.query(`CREATE TABLE "disk_metrics_logs" ("id" varchar PRIMARY KEY NOT NULL, "timestamp" datetime NOT NULL, "usagePercent" real NOT NULL, "usedBytes" integer NOT NULL, "totalBytes" integer NOT NULL, "availableBytes" integer NOT NULL, "partitions" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE INDEX "idx_disk_timestamp" ON "disk_metrics_logs" ("timestamp") `);
        await queryRunner.query(`CREATE TABLE "settings" ("key" varchar(255) PRIMARY KEY NOT NULL, "value" text NOT NULL, "valueType" varchar(50) NOT NULL DEFAULT ('string'), "description" text, "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`DROP INDEX "idx_disk_timestamp"`);
        await queryRunner.query(`DROP TABLE "disk_metrics_logs"`);
        await queryRunner.query(`DROP INDEX "idx_memory_timestamp"`);
        await queryRunner.query(`DROP TABLE "memory_metrics_logs"`);
        await queryRunner.query(`DROP INDEX "idx_cpu_timestamp"`);
        await queryRunner.query(`DROP TABLE "cpu_metrics_logs"`);
    }

}
