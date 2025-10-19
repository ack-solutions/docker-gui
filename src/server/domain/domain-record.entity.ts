import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

@Entity({ name: "domain_records" })
@Index("idx_domain_record_domain", ["domainId"])
export class DomainRecordEntity extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  domainId!: string;

  @ManyToOne(() => require("./domain.entity").DomainEntity, (domain: any) => domain.records, { onDelete: "CASCADE" })
  domain!: any;

  @Column({ type: "text" })
  type!: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "SRV" | "CAA" | "NS";

  @Column({ type: "text" })
  host!: string;

  @Column({ type: "text" })
  value!: string;

  @Column({ type: "integer", default: 300 })
  ttl!: number;

  @Column({ type: "integer", nullable: true })
  priority?: number | null;

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP"
  })
  updatedAt!: Date;
}
