import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export type DomainMode = "external-dns" | "pointer-only" | "managed";
export type DomainTargetType = "none" | "container" | "service" | "external" | "static";

@Entity({ name: "domains" })
export class DomainEntity extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text", unique: true })
  name!: string;

  @Column({ type: "simple-json", default: "[]" })
  aliases!: string[];

  @Column({ type: "text", nullable: true })
  provider?: string | null;

  @Column({ type: "text", default: "pending" })
  status!: "active" | "pending" | "error";

  @Column({ type: "text", default: "managed" })
  mode!: DomainMode;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @Column({ type: "text", default: "none" })
  targetType!: DomainTargetType;

  @Column({ type: "text", nullable: true })
  targetContainerId?: string | null;

  @Column({ type: "integer", nullable: true })
  targetContainerPort?: number | null;

  @Column({ type: "text", nullable: true })
  targetServiceHost?: string | null;

  @Column({ type: "text", nullable: true })
  targetExternalUrl?: string | null;

  @Column({ type: "text", nullable: true })
  targetStaticRoot?: string | null;

  @Column({ type: "boolean", default: true })
  enableHttp!: boolean;

  @Column({ type: "boolean", default: true })
  enableHttps!: boolean;

  @Column({ type: "boolean", default: false })
  forceHttps!: boolean;

  @Column({ type: "text", default: "lets-encrypt" })
  sslMode!: "none" | "lets-encrypt" | "custom";

  @Column({ type: "text", nullable: true })
  letsEncryptEmail?: string | null;

  @Column({ type: "text", nullable: true })
  sslCertificateId?: string | null;

  @Column({ type: "text", nullable: true })
  nginxSiteId?: string | null;

  @Column({ type: "text", nullable: true })
  lastError?: string | null;

  @OneToMany(() => require("./domain-record.entity").DomainRecordEntity, (record: any) => record.domain, { cascade: true })
  records!: any[];

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP"
  })
  updatedAt!: Date;
}
