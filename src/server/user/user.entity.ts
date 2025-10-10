import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { UserPermission, UserRole } from "../../types/user";

@Entity({ name: "users" })
export class UserEntity extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name?: string | null;

  @Column({ type: "varchar", length: 32 })
  role!: UserRole;

  @Column({ type: "simple-json" })
  permissions!: UserPermission[];

  @Column({ default: false })
  isSuperAdmin!: boolean;

  @CreateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
