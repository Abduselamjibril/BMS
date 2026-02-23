import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lease } from './lease.entity';

export enum LeasePaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
}

@Entity('lease_payments')
export class LeasePayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Lease, { nullable: false })
  @JoinColumn({ name: 'lease_id' })
  lease!: Lease;

  @Column({ type: 'date' })
  due_date!: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: LeasePaymentStatus, default: LeasePaymentStatus.PENDING })
  status!: LeasePaymentStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
