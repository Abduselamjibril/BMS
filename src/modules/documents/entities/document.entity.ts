import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';

@Entity('documents')
@Index('idx_module_type', ['module_type'])
@Index('idx_module_id', ['module_id'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  file_name!: string;

  @Column({ length: 100 })
  mime_type!: string;

  @Column('int')
  file_size!: number;

  @Column({ length: 200 })
  storage_path!: string;

  @Column({ length: 30 })
  module_type!: string; // lease, tenant, maintenance, payment

  @Column({ length: 50 })
  module_id!: string;

  @Column('int')
  version!: number;

  @Column({ default: false })
  is_deleted!: boolean;
}

@Entity('document_versions')
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50 })
  document_id!: string;

  @Column('int')
  version_number!: number;

  @Column({ length: 200 })
  storage_path!: string;

  @Column({ type: 'timestamp' })
  uploaded_at!: Date;
}
