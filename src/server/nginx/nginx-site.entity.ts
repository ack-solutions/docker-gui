import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export type NginxSslMode = "none" | "lets-encrypt" | "custom";
export type NginxSiteStatus = "draft" | "pending" | "active" | "error";

@Entity({ name: "nginx_sites" })
@Index("idx_nginx_site_primary_domain", ["primaryDomain"], { unique: true })
export class NginxSiteEntity extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  primaryDomain!: string;

  @Column({ type: "simple-json" })
  serverNames!: string[];

  @Column({ type: "text" })
  upstreamType!: "container" | "service" | "external";

  @Column({ type: "text" })
  upstreamTarget!: string;

  @Column({ type: "text", nullable: true })
  containerId?: string | null;

  @Column({ type: "integer", nullable: true })
  containerPort?: number | null;

  @Column({ type: "boolean", default: true })
  enableHttp!: boolean;

  @Column({ type: "boolean", default: true })
  enableHttps!: boolean;

  @Column({ type: "boolean", default: false })
  forceHttps!: boolean;

  @Column({ type: "text", default: "lets-encrypt" })
  sslMode!: NginxSslMode;

  @Column({ type: "text", nullable: true })
  letsEncryptEmail?: string | null;

  @Column({ type: "text", nullable: true })
  sslCertificateId?: string | null;

  @Column({ type: "boolean", default: true })
  enabled!: boolean;

  @Column({ type: "text", default: "draft" })
  status!: NginxSiteStatus;

  @Column({ type: "text", nullable: true })
  lastError?: string | null;

  @Column({ type: "datetime", nullable: true })
  lastAppliedAt?: Date | null;

  @Column({ type: "datetime", nullable: true })
  lastValidatedAt?: Date | null;

  @Column({ type: "text", nullable: true })
  configPath?: string | null;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @Column({ type: "text", nullable: true })
  extraDirectives?: string | null;

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP"
  })
  updatedAt!: Date;
}
