import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { Amenity } from './amenity.entity';

@Entity('building_amenities')
@Index('idx_bldgamen_building', ['building'])
export class BuildingAmenity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Building, (building) => building.buildingAmenities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'building_id' })
  building!: Building;

  @ManyToOne(() => Amenity, (amenity) => amenity.buildingAmenities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'amenity_id' })
  amenity!: Amenity;
}
