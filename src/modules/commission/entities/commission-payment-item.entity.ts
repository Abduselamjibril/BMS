import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CommissionPayment } from './commission-payment.entity';
import { Commission } from './commission.entity';

@Entity('commission_payment_items')
export class CommissionPaymentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CommissionPayment, (payment) => payment.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: CommissionPayment;

  @Column()
  payment_id: string;

  @ManyToOne(() => Commission, { nullable: false })
  @JoinColumn({ name: 'commission_id' })
  commission: Commission;

  @Column()
  commission_id: string;
}
