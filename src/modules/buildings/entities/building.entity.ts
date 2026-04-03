import { Site } from '../../sites/entities/site.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Owner } from '../../owners/entities/owner.entity';
import { Unit } from '../../units/entities/unit.entity';
import { BuildingAmenity } from '../../amenities/entities/building-amenity.entity';
import { BuildingAdminAssignment } from '../../buildings/entities/building-admin-assignment.entity';

export enum BuildingType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  MIXED = 'mixed',
}

export enum BuildingStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('buildings')
@Index('idx_building_city', ['city'])
@Index('idx_building_owner', ['owner'])
@Index('idx_building_type', ['type'])
export class Building {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ unique: true })
  code!: string;

  @ManyToOne(() => Owner, (owner) => owner.buildings, { nullable: false })
  owner!: Owner;

  @ManyToOne(() => Site, (site) => site.buildings, { nullable: false })
  site!: Site;

  @Column({ type: 'enum', enum: BuildingType })
  type!: BuildingType;

  @Column({ length: 50 })
  country!: string;

  @Column({ length: 50 })
  city!: string;

  @Column({ length: 50 })
  subcity!: string;

  @Column({ length: 200 })
  address!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column('int')
  total_units!: number;

  @Column({
    type: 'enum',
    enum: BuildingStatus,
    default: BuildingStatus.ACTIVE,
  })
  status!: BuildingStatus;

  @OneToMany(() => Unit, (unit) => unit.building)
  units!: Unit[];

  @OneToMany(() => BuildingAmenity, (ba) => ba.building)
  buildingAmenities!: BuildingAmenity[];

  @OneToMany(() => BuildingAdminAssignment, (baa) => baa.building)
  adminAssignments!: BuildingAdminAssignment[];
}
