import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { ManagementAssignment } from './management-assignment.entity';

@Entity('management_companies')
@Index('idx_mgmtco_active', ['is_active'])
export class ManagementCompany {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  registration_number: string;

  @Column({ nullable: true })
  tin_number: string;

  @Column({ nullable: true })
  company_type: string; // e.g., PLC, Share Company, LLC

  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  phone_primary: string;

  @Column({ nullable: true })
  phone_secondary: string;

  @Column({ nullable: true })
  email_business: string;

  @Column({ nullable: true })
  email_support: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  bank_name: string;

  @Column({ nullable: true })
  bank_account_number: string;

  @Column({ nullable: true })
  bank_account_name: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => ManagementAssignment, (assignment) => assignment.company)
  assignments: ManagementAssignment[];

  @CreateDateColumn()
  created_at: Date;
}
