import { Entity, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Building } from '../../buildings/entities/building.entity';

@Entity('user_buildings')
@Index('idx_userbldg_user', ['user'])
export class UserBuilding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @ManyToOne(() => Building, { nullable: false })
  building!: Building;
}
