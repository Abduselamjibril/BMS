import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Site } from '../../sites/entities/site.entity';

export enum VisitorStatus {
  IN = 'in',
  EXITED = 'exited',
}

@Entity('visitors')
export class Visitor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  site_id!: string;

  @Index()
  @Column({ nullable: true })
  unit_id?: string;

  @Column({ length: 200 })
  visitor_name!: string;

  @Column({ length: 50, nullable: true })
  phone?: string;

  @Column({ length: 100, nullable: true })
  id_card_no?: string;

  @Column({ type: 'timestamp', nullable: true })
  check_in_time?: Date;

  @Column({ type: 'timestamp', nullable: true })
  check_out_time?: Date;

  @Column({ type: 'enum', enum: VisitorStatus, default: VisitorStatus.IN })
  status!: VisitorStatus;

  @CreateDateColumn()
  created_at!: Date;
}
