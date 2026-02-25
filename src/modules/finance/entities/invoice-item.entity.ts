import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Invoice } from './invoice.entity';

export enum InvoiceItemType {
  RENT = 'RENT',
  UTILITY = 'UTILITY',
  MAINTENANCE = 'MAINTENANCE',
  PENALTY = 'PENALTY',
}

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { nullable: false })
  invoice!: Invoice;

  @Column({ type: 'enum', enum: InvoiceItemType })
  type!: InvoiceItemType;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column({ length: 200, nullable: true })
  description?: string;
}
