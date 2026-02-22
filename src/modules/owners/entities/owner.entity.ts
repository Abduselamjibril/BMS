import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20 })
  phone!: string;

  @OneToMany(() => Building, (building) => building.owner)
  buildings!: Building[];
}
