import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { ManagementAssignment } from './management-assignment.entity';

@Entity('management_permissions')
export class ManagementPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ManagementAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: ManagementAssignment;

  @Column()
  assignment_id: string;

  @Column({ default: true })
  can_manage_tenants: boolean;

  @Column({ default: true })
  can_manage_leases: boolean;

  @Column({ default: true })
  can_manage_maintenance: boolean;

  @Column({ default: false })
  can_view_financials: boolean;
}
