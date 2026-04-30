import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Lease } from './lease.entity';

export enum LeasePaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
}

@Entity('lease_payments')
@Index('idx_leasepay_status', ['status'])
@Index('idx_leasepay_due_date', ['due_date'])
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

  @Column({
    type: 'enum',
    enum: LeasePaymentStatus,
    default: LeasePaymentStatus.PENDING,
  })
  status!: LeasePaymentStatus;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  late_fee!: number;

  @Column({ type: 'int', default: 0 })
  days_overdue!: number;

  get total_due(): number {
    return Number(this.amount) + Number(this.late_fee);
  }

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
