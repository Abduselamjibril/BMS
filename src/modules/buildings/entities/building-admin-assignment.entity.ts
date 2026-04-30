import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Building } from './building.entity';

@Entity('building_admin_assignments')
@Index('idx_baa_status', ['status'])
export class BuildingAdminAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Building, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'building_id' })
  building!: Building;

  @CreateDateColumn()
  assigned_at!: Date;

  @Column({ nullable: true })
  assigned_by?: string;

  @Column({ default: 'active' })
  status!: string;
}
