import { CreateDateColumn } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Invoice } from './invoice.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Invoice, { nullable: false })
  invoice!: Invoice;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column({ length: 50 })
  reference_no!: string;

  @Column({ length: 200, nullable: true })
  proof_url?: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  created_at!: Date;
}
