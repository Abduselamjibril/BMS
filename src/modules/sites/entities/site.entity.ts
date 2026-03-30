import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50 })
  city!: string;

  @Column({ length: 50 })
  subcity!: string;

  @Column({ length: 100 })
  location_lat_long!: string;

  @Column({ length: 50, nullable: true })
  code?: string;

  @Column({ length: 255, nullable: true })
  address?: string;

  @Column({ length: 50, nullable: true })
  timezone?: string;

  @Column({ length: 10, nullable: true })
  currency?: string;

  @Column({ length: 100, nullable: true })
  contact_email?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ length: 255, nullable: true })
  image_url?: string;

  @OneToMany(() => Building, (building) => building.site)
  buildings!: Building[];
}
