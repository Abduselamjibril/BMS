import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('automation_jobs')
@Index('idx_autojob_enabled', ['is_enabled'])
export class AutomationJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column()
  label!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  schedule?: string;

  @Column({ default: true })
  is_enabled!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_run_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
