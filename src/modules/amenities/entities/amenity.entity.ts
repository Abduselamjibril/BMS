import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { BuildingAmenity } from './building-amenity.entity';
import { UnitAmenity } from './unit-amenity.entity';

@Entity('amenities')
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 50 })
  category!: string;

  @OneToMany(() => BuildingAmenity, (ba) => ba.amenity)
  buildingAmenities!: BuildingAmenity[];

  @OneToMany(() => UnitAmenity, (ua) => ua.amenity)
  unitAmenities!: UnitAmenity[];
}
