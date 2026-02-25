import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { QRCode } from './qr-code.entity';

@Entity('qr_scan_logs')
export class QRScanLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  qr_id!: string;

  @ManyToOne(() => QRCode)
  @JoinColumn({ name: 'qr_id' })
  qr?: QRCode;

  @Column({ type: 'timestamp' })
  scanned_at!: Date;

  @Column({ type: 'text', nullable: true })
  device_type?: string;

  @Column({ length: 45, nullable: true })
  ip_address?: string;

  @CreateDateColumn()
  created_at!: Date;
}
