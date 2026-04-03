import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum JobStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('job_logs')
export class JobLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  job_name!: string;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.SUCCESS,
  })
  status!: JobStatus;

  @Column({ type: 'jsonb', nullable: true })
  result?: any;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn()
  @Index()
  executed_at!: Date;
}
