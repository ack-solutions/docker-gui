import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex
} from "typeorm";

export class AddDomainsAndRecords1761500000000 implements MigrationInterface {
  name = "AddDomainsAndRecords1761500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasDomainTable = await queryRunner.hasTable("domains");
    if (!hasDomainTable) {
      await queryRunner.createTable(
        new Table({
          name: "domains",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "name", type: "text", isUnique: true },
            { name: "aliases", type: "text", default: "'[]'" },
            { name: "provider", type: "text", isNullable: true },
            { name: "status", type: "text", default: "'pending'" },
            { name: "managed", type: "integer", default: 1 },
            { name: "notes", type: "text", isNullable: true },
            { name: "targetType", type: "text", default: "'none'" },
            { name: "targetContainerId", type: "text", isNullable: true },
            { name: "targetContainerPort", type: "integer", isNullable: true },
            { name: "targetServiceHost", type: "text", isNullable: true },
            { name: "targetExternalUrl", type: "text", isNullable: true },
            { name: "enableHttp", type: "integer", default: 1 },
            { name: "enableHttps", type: "integer", default: 1 },
            { name: "forceHttps", type: "integer", default: 0 },
            { name: "sslMode", type: "text", default: "'lets-encrypt'" },
            { name: "letsEncryptEmail", type: "text", isNullable: true },
            { name: "sslCertificateId", type: "text", isNullable: true },
            { name: "nginxSiteId", type: "text", isNullable: true },
            { name: "lastError", type: "text", isNullable: true },
            {
              name: "createdAt",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false
            },
            {
              name: "updatedAt",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false
            }
          ]
        })
      );
      await queryRunner.createIndex(
        "domains",
        new TableIndex({
          name: "idx_domains_name",
          columnNames: ["name"],
          isUnique: true
        })
      );
    }

    const hasRecordsTable = await queryRunner.hasTable("domain_records");
    if (!hasRecordsTable) {
      await queryRunner.createTable(
        new Table({
          name: "domain_records",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "domainId", type: "varchar", length: "36" },
            { name: "type", type: "text" },
            { name: "host", type: "text" },
            { name: "value", type: "text" },
            { name: "ttl", type: "integer", default: 300 },
            { name: "priority", type: "integer", isNullable: true },
            {
              name: "createdAt",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false
            },
            {
              name: "updatedAt",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false
            }
          ]
        })
      );

      await queryRunner.createIndex(
        "domain_records",
        new TableIndex({
          name: "idx_domain_records_domain",
          columnNames: ["domainId"]
        })
      );

      await queryRunner.createForeignKey(
        "domain_records",
        new TableForeignKey({
          columnNames: ["domainId"],
          referencedTableName: "domains",
          referencedColumnNames: ["id"],
          onDelete: "CASCADE"
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const recordsTable = await queryRunner.getTable("domain_records");
    if (recordsTable) {
      const foreignKey = recordsTable.foreignKeys.find((fk) => fk.columnNames.includes("domainId"));
      if (foreignKey) {
        await queryRunner.dropForeignKey("domain_records", foreignKey);
      }
    }

    await queryRunner.dropTable("domain_records", true);
    await queryRunner.dropTable("domains", true);
  }
}
