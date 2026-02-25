import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { BankAccount } from './bank-account.entity';

@Entity('deposit_advices')
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
}
