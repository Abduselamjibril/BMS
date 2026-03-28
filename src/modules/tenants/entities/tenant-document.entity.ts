import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export enum TenantDocumentType {
  ID = 'ID',
  PASSPORT = 'PASSPORT',
  CONTRACT = 'CONTRACT',
  PRIMARY_ID = 'PRIMARY_ID',
}

@Entity('tenant_documents')
export class TenantDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.documents, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({
    type: 'enum',
    enum: TenantDocumentType,
  })
  type!: TenantDocumentType;

  @Column({ length: 500 })
  file_url!: string;

  @Column({ default: false })
  verified!: boolean;

  @Column({ nullable: true, type: 'text' })
  reject_reason?: string;

  @Column({ type: 'timestamp', nullable: true })
  expiry_date?: Date;

  @CreateDateColumn()
  created_at!: Date;
}
