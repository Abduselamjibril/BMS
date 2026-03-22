import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('admin_activity_logs')
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
