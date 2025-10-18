import { BaseEntity, Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "settings" })
export class SettingsEntity extends BaseEntity {
  @PrimaryColumn({ type: "varchar", length: 255 })
  key!: string;

  @Column({ type: "text" })
  value!: string;

  @Column({ type: "varchar", length: 50, default: "string" })
  valueType!: "string" | "number" | "boolean" | "json";

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @UpdateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}

