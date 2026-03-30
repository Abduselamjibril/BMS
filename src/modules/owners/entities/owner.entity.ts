import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 100, nullable: true })
  email?: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({ length: 255, nullable: true })
  profile_image?: string;

  @OneToMany(() => Building, (building) => building.owner)
  buildings!: Building[];
}
