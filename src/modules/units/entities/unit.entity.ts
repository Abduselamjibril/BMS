import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { UnitAmenity } from '../../amenities/entities/unit-amenity.entity';

export enum UnitType {
  STUDIO = 'studio',
  ONE_BEDROOM = '1BR',
  TWO_BEDROOM = '2BR',
  OFFICE = 'office',
  SHOP = 'shop',
}

export enum UnitStatus {
  VACANT = 'vacant',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
  RESERVED = 'reserved',
}

@Entity('units')
@Index('idx_unit_status', ['status'])
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Building, (building) => building.units, { nullable: false })
  building!: Building;

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

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  sale_price?: number;

  @Column({ type: 'enum', enum: UnitStatus, default: UnitStatus.VACANT })
  status!: UnitStatus;

  @Column('int')
  bedrooms!: number;

  @Column('int')
  bathrooms!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @OneToMany(() => UnitAmenity, (ua) => ua.unit)
  unitAmenities!: UnitAmenity[];
}
