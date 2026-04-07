import { CreateDateColumn } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';
import { BankAccount } from './bank-account.entity';

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

  @ManyToOne(() => BankAccount, { nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bank_account?: BankAccount;

  @Column({ nullable: true })
  bank_account_id?: string;

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
