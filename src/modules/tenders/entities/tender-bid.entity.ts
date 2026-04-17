import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LeaseTender } from './lease-tender.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum BidStatus {
  PENDING = 'PENDING',
  SHORTLISTED = 'SHORTLISTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('tender_bids')
export class TenderBid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LeaseTender, (tender) => tender.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tender_id' })
  tender: LeaseTender;

  @Column()
  tender_id: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  proposed_rent: number;

  @Column({ type: 'date' })
  proposed_start_date: string;

  @Column({ type: 'text', nullable: true })
  proposal_details: string;

  @Column({ type: 'enum', enum: BidStatus, default: BidStatus.PENDING })
  status: BidStatus;

  @CreateDateColumn()
  submitted_at: Date;
}
