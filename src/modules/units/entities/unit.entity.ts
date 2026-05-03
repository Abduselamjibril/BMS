import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { UnitAmenity } from '../../amenities/entities/unit-amenity.entity';
import { Asset } from '../../assets/entities/asset.entity';

export enum UnitType {
  STUDIO = 'STUDIO',
  ONE_BEDROOM = '1BR',
  TWO_BEDROOM = '2BR',
  OFFICE = 'OFFICE',
  SHOP = 'SHOP',
}

export enum UnitStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE',
  RESERVED = 'RESERVED',
}

@Entity('units')
@Index('idx_unit_status', ['status'])
@Index('idx_unit_number', ['unit_number'])
@Index('idx_unit_building', ['building'])
@Index('idx_unit_type', ['type'])
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Building, (building) => building.units, { nullable: false })
  @JoinColumn({ name: 'building_id' })
  building!: Building;

  @Column({ nullable: true })
  building_id!: string;

  @Column()
  unit_number!: string;

  @Column('int')
  floor!: number;

  @Column({ type: 'enum', enum: UnitType })
  type!: UnitType;

  @Column('float')
  size_sqm!: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  rent_price?: number;

  @Column({ type: 'enum', enum: UnitStatus, default: UnitStatus.VACANT })
  status!: UnitStatus;

  @Column('int')
  bedrooms!: number;

  @Column('int')
  bathrooms!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url?: string;

  @OneToMany(() => UnitAmenity, (ua) => ua.unit)
  unitAmenities!: UnitAmenity[];

  @OneToMany(() => Asset, (a) => a.unit)
  assets!: Asset[];
}
