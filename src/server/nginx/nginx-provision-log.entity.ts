import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import { NginxSiteEntity } from "@/server/nginx/nginx-site.entity";

export type NginxProvisionLogLevel = "info" | "warn" | "error" | "success";

@Entity({ name: "nginx_provision_logs" })
@Index("idx_nginx_provision_site", ["siteId"])
export class NginxProvisionLogEntity extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  siteId!: string;

  @ManyToOne(() => NginxSiteEntity, { onDelete: "CASCADE" })
  site!: NginxSiteEntity;

  @Column({ type: "text" })
  level!: NginxProvisionLogLevel;

  @Column({ type: "text" })
  message!: string;

  @Column({ type: "simple-json", nullable: true })
  details?: Record<string, unknown> | null;

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
