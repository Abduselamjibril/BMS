import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from './tenant.entity';

export enum TenantDocumentType {
  ID = 'ID',
  PASSPORT = 'Passport',
  CONTRACT = 'Contract',
  PRIMARY_ID = 'Primary ID',
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

  @CreateDateColumn()
  created_at!: Date;
}
