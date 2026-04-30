import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('admin_activity_logs')
@Index('idx_audit_user', ['user_id'])
@Index('idx_audit_entity_type', ['entity_type'])
@Index('idx_audit_timestamp', ['timestamp'])
export class AdminActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  user_id!: string;

  @Column()
  action!: string;

  @Column()
  entity_type!: string;

  @Column()
  entity_id!: string;

  @CreateDateColumn()
  timestamp!: Date;

  @Column()
  ip_address!: string;
}
