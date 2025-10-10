import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class InitUsers1708064400000 implements MigrationInterface {
  name = "InitUsers1708064400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "varchar",
            isPrimary: true,
            isNullable: false,
            isGenerated: true,
            generationStrategy: "uuid"
          },
          {
            name: "email",
            type: "varchar",
            isNullable: false
          },
          {
            name: "passwordHash",
            type: "varchar",
            isNullable: false
          },
          {
            name: "name",
            type: "varchar",
            isNullable: true
          },
          {
            name: "role",
            type: "varchar",
            length: "32",
            isNullable: false,
            default: "'viewer'"
          },
          {
            name: "permissions",
            type: "text",
            isNullable: false,
            default: "'[]'"
          },
          {
            name: "isSuperAdmin",
            type: "boolean",
            isNullable: false,
            default: "0"
          },
          {
            name: "createdAt",
            type: "datetime",
            isNullable: false,
            default: "CURRENT_TIMESTAMP"
          },
          {
            name: "updatedAt",
            type: "datetime",
            isNullable: false,
            default: "CURRENT_TIMESTAMP"
          }
        ]
      }),
      true
    );

    await queryRunner.createIndex(
      "users",
      new TableIndex({
        name: "IDX_users_email_unique",
        columnNames: ["email"],
        isUnique: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("users", "IDX_users_email_unique");
    await queryRunner.dropTable("users");
  }
}
