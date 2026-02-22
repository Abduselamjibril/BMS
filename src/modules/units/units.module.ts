import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { Unit } from './entities/unit.entity';
import { UnitAmenity } from '../amenities/entities/unit-amenity.entity';
import { Amenity } from '../amenities/entities/amenity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Unit, UnitAmenity, Amenity])],
  controllers: [UnitsController],
  providers: [UnitsService],
})
export class UnitsModule {}
