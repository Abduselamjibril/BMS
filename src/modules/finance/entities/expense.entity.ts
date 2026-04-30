import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';

@Entity('expenses')
@Index('idx_expense_category', ['category'])
@Index('idx_expense_building', ['building_id'])
@Index('idx_expense_date', ['date'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  date: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  building_id: string;

  @ManyToOne(() => Building, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @Column({ nullable: true })
  bank_account_id: string;

  @ManyToOne('BankAccount', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: any;

  @Column({ nullable: true, length: 500 })
  receipt_url: string;

  @CreateDateColumn()
  created_at: Date;
}
