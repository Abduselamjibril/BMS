import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { Unit } from '../../units/entities/unit.entity';
import { TenderBid } from './tender-bid.entity';

export enum TenderStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  AWARDED = 'AWARDED',
  CANCELLED = 'CANCELLED',
}

@Entity('lease_tenders')
@Index('idx_tender_status', ['status'])
@Index('idx_tender_closing_date', ['closing_date'])
export class LeaseTender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Building, { nullable: false })
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @Column()
  building_id: string;

  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column()
  unit_id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  minimum_acceptable_bid: number;

  @Column({ type: 'timestamp' })
  closing_date: Date;

  @Column({ type: 'enum', enum: TenderStatus, default: TenderStatus.DRAFT })
  status: TenderStatus;

  @OneToMany(() => TenderBid, (bid) => bid.tender)
  bids: TenderBid[];

  @CreateDateColumn()
  created_at: Date;
}
