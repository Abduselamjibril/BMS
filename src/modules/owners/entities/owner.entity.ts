import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, OneToOne, JoinColumn } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { User } from '../../users/entities/user.entity';

@Entity('owners')
@Index('idx_owner_email', ['email'])
@Index('idx_owner_name', ['name'])
@Index('idx_owner_phone', ['phone'])
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

  @Column({ nullable: true })
  user_id?: string;

  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @OneToMany(() => Building, (building) => building.owner)
  buildings!: Building[];
}
