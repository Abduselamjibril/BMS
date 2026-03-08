import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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
}
