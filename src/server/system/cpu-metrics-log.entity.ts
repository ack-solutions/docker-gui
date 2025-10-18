import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "cpu_metrics_logs" })
@Index("idx_cpu_timestamp", ["timestamp"])
export class CpuMetricsLogEntity extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "datetime" })
  timestamp!: Date;

  @Column({ type: "real" })
  usagePercent!: number;

  @Column({ type: "real" })
  loadAverage1m!: number;

  @Column({ type: "real" })
  loadAverage5m!: number;

  @Column({ type: "real" })
  loadAverage15m!: number;

  @Column({ type: "simple-json" })
  coresUsage!: { coreId: string; usagePercent: number }[];

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}

