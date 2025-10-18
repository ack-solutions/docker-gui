import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "disk_metrics_logs" })
@Index("idx_disk_timestamp", ["timestamp"])
export class DiskMetricsLogEntity extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "datetime" })
  timestamp!: Date;

  @Column({ type: "real" })
  usagePercent!: number;

  @Column({ type: "integer" })
  usedBytes!: number;

  @Column({ type: "integer" })
  totalBytes!: number;

  @Column({ type: "integer" })
  availableBytes!: number;

  @Column({ type: "simple-json" })
  partitions!: { filesystem: string; mountpoint: string; usagePercent: number; usedBytes: number; totalBytes: number }[];

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}

