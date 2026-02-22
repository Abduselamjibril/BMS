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

  @OneToMany(() => Building, (building) => building.site)
  buildings!: Building[];
}
