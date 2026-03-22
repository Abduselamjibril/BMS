import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Lease } from '../../leases/entities/lease.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Unit } from '../../units/entities/unit.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Lease, { nullable: false })
  lease!: Lease;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant!: Tenant;

  @ManyToOne(() => Unit, { nullable: false })
  unit!: Unit;

  @Column({ unique: true })
  invoice_no!: string;

  @Column('date')
  due_date!: string;

  @Column('decimal', { precision: 12, scale: 2 })
  subtotal!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  tax_amount!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  total_amount!: number;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status!: InvoiceStatus;

  @OneToMany(() => InvoiceItem, (item) => item.invoice)
  items!: InvoiceItem[];

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments!: Payment[];
}
