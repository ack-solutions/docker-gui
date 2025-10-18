import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex
} from "typeorm";

export class AddNginxSitesAndProvisionLogs1761400000000 implements MigrationInterface {
  name = "AddNginxSitesAndProvisionLogs1761400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSitesTable = await queryRunner.hasTable("nginx_sites");
    if (!hasSitesTable) {
      await queryRunner.createTable(
        new Table({
          name: "nginx_sites",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "primary_domain", type: "text", isNullable: false },
            { name: "server_names", type: "text", isNullable: false },
            { name: "upstream_type", type: "text", isNullable: false },
            { name: "upstream_target", type: "text", isNullable: false },
            { name: "container_id", type: "text", isNullable: true },
            { name: "container_port", type: "integer", isNullable: true },
            { name: "enable_http", type: "integer", default: 1, isNullable: false },
            { name: "enable_https", type: "integer", default: 1, isNullable: false },
            { name: "force_https", type: "integer", default: 0, isNullable: false },
            { name: "ssl_mode", type: "text", default: "'lets-encrypt'", isNullable: false },
            { name: "lets_encrypt_email", type: "text", isNullable: true },
            { name: "ssl_certificate_id", type: "text", isNullable: true },
            { name: "enabled", type: "integer", default: 1, isNullable: false },
            { name: "status", type: "text", default: "'draft'", isNullable: false },
            { name: "last_error", type: "text", isNullable: true },
            { name: "last_applied_at", type: "datetime", isNullable: true },
            { name: "last_validated_at", type: "datetime", isNullable: true },
            { name: "config_path", type: "text", isNullable: true },
            { name: "notes", type: "text", isNullable: true },
            { name: "extra_directives", type: "text", isNullable: true },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false
            },
            {
              name: "updated_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false
            }
          ]
        })
      );

      await queryRunner.createIndex(
        "nginx_sites",
        new TableIndex({
          name: "idx_nginx_site_primary_domain",
          columnNames: ["primary_domain"],
          isUnique: true
        })
      );
    }

    const hasLogsTable = await queryRunner.hasTable("nginx_provision_logs");
    if (!hasLogsTable) {
      await queryRunner.createTable(
        new Table({
          name: "nginx_provision_logs",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "site_id", type: "varchar", length: "36", isNullable: false },
            { name: "level", type: "text", isNullable: false },
            { name: "message", type: "text", isNullable: false },
            { name: "details", type: "text", isNullable: true },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false
            }
          ]
        })
      );

      await queryRunner.createIndex(
        "nginx_provision_logs",
        new TableIndex({
          name: "idx_nginx_provision_site",
          columnNames: ["site_id"]
        })
      );

      await queryRunner.createForeignKey(
        "nginx_provision_logs",
        new TableForeignKey({
          columnNames: ["site_id"],
          referencedColumnNames: ["id"],
          referencedTableName: "nginx_sites",
          onDelete: "CASCADE"
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("nginx_provision_logs");
    if (table) {
      const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.includes("site_id"));
      if (foreignKey) {
        await queryRunner.dropForeignKey("nginx_provision_logs", foreignKey);
      }
    }
    await queryRunner.dropTable("nginx_provision_logs", true);
    await queryRunner.dropTable("nginx_sites", true);
  }
}
