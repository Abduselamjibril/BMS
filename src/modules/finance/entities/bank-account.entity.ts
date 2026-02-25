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
}
