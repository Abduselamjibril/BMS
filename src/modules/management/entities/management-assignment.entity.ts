import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ManagementCompany } from './management-company.entity';
import { Building } from '../../buildings/entities/building.entity';
import { Unit } from '../../units/entities/unit.entity';

export enum ManagementScope {
  BUILDING = 'BUILDING',
  UNIT = 'UNIT',
}

@Entity('management_assignments')
export class ManagementAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ManagementCompany, (company) => company.assignments, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: ManagementCompany;

  @Column()
  company_id: string;

  @Column({ type: 'enum', enum: ManagementScope })
  scope_type: ManagementScope;

  @ManyToOne(() => Building, { nullable: true })
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @Column({ nullable: true })
  building_id: string;

  @ManyToOne(() => Unit, { nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ nullable: true })
  unit_id: string;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
