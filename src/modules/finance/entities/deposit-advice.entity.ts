import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { BankAccount } from './bank-account.entity';

@Entity('deposit_advices')
@Index('idx_deposit_status', ['status'])
export class DepositAdvice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => BankAccount, { nullable: false })
  bank_account!: BankAccount;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column('date')
  deposit_date!: string;

  @Column({ length: 50 })
  reference_no!: string;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ nullable: true })
  processed_by!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
