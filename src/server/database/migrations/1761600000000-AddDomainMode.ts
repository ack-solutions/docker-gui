import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddDomainMode1761600000000 implements MigrationInterface {
  name = "AddDomainMode1761600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("domains");
    if (!table) {
      return;
    }

    const hasModeColumn = table.columns.some((column) => column.name === "mode");
    if (!hasModeColumn) {
      await queryRunner.addColumn(
        "domains",
        new TableColumn({
          name: "mode",
          type: "text",
          isNullable: false,
          default: "'managed'"
        })
      );
    }

    const hasStaticRootColumn = table.columns.some((column) => column.name === "targetStaticRoot");
    if (!hasStaticRootColumn) {
      await queryRunner.addColumn(
        "domains",
        new TableColumn({
          name: "targetStaticRoot",
          type: "text",
          isNullable: true
        })
      );
    }

    const hasManagedColumn = table.columns.some((column) => column.name === "managed");
    if (hasManagedColumn) {
      await queryRunner.query(
        `UPDATE domains SET mode = CASE WHEN managed = 1 THEN 'managed' ELSE 'external-dns' END`
      );
      await queryRunner.dropColumn("domains", "managed");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("domains");
    if (!table) {
      return;
    }

    const hasManagedColumn = table.columns.some((column) => column.name === "managed");
    if (!hasManagedColumn) {
      await queryRunner.addColumn(
        "domains",
        new TableColumn({
          name: "managed",
          type: "integer",
          isNullable: false,
          default: 1
        })
      );
    }

    const hasModeColumn = table.columns.some((column) => column.name === "mode");
    if (hasModeColumn) {
      await queryRunner.query(
        `UPDATE domains SET managed = CASE WHEN mode = 'managed' THEN 1 ELSE 0 END`
      );
      await queryRunner.dropColumn("domains", "mode");
    }

    const hasStaticRootColumn = table.columns.some((column) => column.name === "targetStaticRoot");
    if (hasStaticRootColumn) {
      await queryRunner.dropColumn("domains", "targetStaticRoot");
    }
  }
}
