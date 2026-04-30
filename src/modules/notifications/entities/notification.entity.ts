import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  LEASE = 'LEASE',
  FINANCE = 'FINANCE',
  MAINTENANCE = 'MAINTENANCE',
  SYSTEM = 'SYSTEM',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  UTILITY = 'UTILITY',
  VISITOR = 'VISITOR',
}

@Entity('notifications')
@Index('idx_notif_user', ['user_id'])
@Index('idx_notif_read', ['is_read'])
@Index('idx_notif_type', ['type'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ length: 120 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}
