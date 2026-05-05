import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { ManagementCompany } from '../../management/entities/management-company.entity';
import { CommissionPaymentItem } from './commission-payment-item.entity';

export enum CommissionPaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

@Entity('commission_payments')
@Index('idx_commpay_status', ['status'])
@Index('idx_payment_date', ['payment_date'])
export class CommissionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ManagementCompany, { nullable: false })
  @JoinColumn({ name: 'nominee_id' })
  nominee: ManagementCompany;

  @Column()
  nominee_id: string;

  @Column({ type: 'date' })
  payment_date: string;

  @Column('decimal', { precision: 12, scale: 2 })
  total_amount: number;

  @Column({ nullable: true })
  reference_no: string;

  @Column({ nullable: true })
  bank_account: string;

  @Column({ type: 'enum', enum: CommissionPaymentStatus, default: CommissionPaymentStatus.PENDING })
  status: CommissionPaymentStatus;

  @OneToMany(() => CommissionPaymentItem, (item) => item.payment)
  items: CommissionPaymentItem[];

  @CreateDateColumn()
  created_at: Date;
}
