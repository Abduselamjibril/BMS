import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  bank_name!: string;

  @Column({ length: 50 })
  account_number!: string;

  @Column({ length: 100 })
  branch!: string;

  @Column({ default: 'active' })
  status!: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  opening_balance!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  current_balance!: number;

  @Column({ default: false })
  is_default!: boolean;
}
