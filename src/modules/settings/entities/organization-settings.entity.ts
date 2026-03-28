import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum LateFeeType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

@Entity('organization_settings')
export class OrganizationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  company_name!: string;

  @Column({ length: 50 })
  tin_number!: string;

  @Column({ length: 50 })
  vat_number!: string;

  @Column({ length: 200, nullable: true })
  logo_path?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.15 })
  vat_rate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.02 })
  withholding_rate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.0 })
  late_fee_percentage!: number;

  @Column({ type: 'enum', enum: LateFeeType, default: LateFeeType.PERCENTAGE })
  late_fee_type!: LateFeeType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  late_fee_flat_amount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0 })
  early_termination_penalty_pct!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0 })
  rent_escalation_pct!: number;

  @Column({ type: 'int', default: 12 })
  default_lease_duration_months!: number;
}
