import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';
import { Amenity } from './amenity.entity';

@Entity('unit_amenities')
export class UnitAmenity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Unit, (unit) => unit.unitAmenities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;

  @ManyToOne(() => Amenity, (amenity) => amenity.unitAmenities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'amenity_id' })
  amenity!: Amenity;
}
