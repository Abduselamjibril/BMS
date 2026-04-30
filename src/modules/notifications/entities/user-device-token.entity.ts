import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_device_tokens')
@Index('idx_devtoken_user', ['user_id'])
export class UserDeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ unique: true })
  fcm_token: string;

  @Column({ length: 32 })
  device_type: string; // e.g., 'mobile_pwa', 'web', 'android', 'ios'

  @Column({ type: 'timestamp', nullable: true })
  last_used: Date;
}
