import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('login_history')
@Index('idx_login_time', ['login_time'])
export class LoginHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.loginHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'login_time' })
  login_time!: Date;

  @Column()
  ip_address!: string;

  @Column({ type: 'boolean' })
  success!: boolean;
}
