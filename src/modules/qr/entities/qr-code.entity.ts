import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum QRCodeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum QRCodeType {
  PUBLIC = 'public',
  INTERNAL = 'internal',
}

@Entity('qrcodes')
@Index('idx_qr_unit', ['unit_id'])
@Index('idx_qr_building', ['building_id'])
@Index('idx_qr_status', ['status'])
@Index('idx_qr_type', ['type'])
export class QRCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50, nullable: true })
  unit_id?: string;

  @Column({ length: 50, nullable: true })
  building_id?: string;

  @Index({ unique: true })
  @Column({ length: 32 })
  token!: string;

  @Column({ type: 'enum', enum: QRCodeStatus, default: QRCodeStatus.ACTIVE })
  status!: QRCodeStatus;

  @Column({ type: 'enum', enum: QRCodeType, default: QRCodeType.PUBLIC })
  type!: QRCodeType;

  @Column({ type: 'int', default: 0 })
  scan_count!: number;

  @Column({ type: 'timestamp', nullable: true })
  expires_at?: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
