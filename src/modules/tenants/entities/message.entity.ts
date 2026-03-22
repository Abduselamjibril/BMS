import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'receiver_id' })
  receiver!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: false })
  read_status!: boolean;

  @CreateDateColumn({ name: 'sent_at' })
  sent_at!: Date;
}
