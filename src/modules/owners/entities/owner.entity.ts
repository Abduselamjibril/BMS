import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';

@Entity('owners')
@Index('idx_owner_email', ['email'])
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
