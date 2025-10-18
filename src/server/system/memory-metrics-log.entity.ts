import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "memory_metrics_logs" })
@Index("idx_memory_timestamp", ["timestamp"])
export class MemoryMetricsLogEntity extends BaseEntity {
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
  freeBytes!: number;

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}

