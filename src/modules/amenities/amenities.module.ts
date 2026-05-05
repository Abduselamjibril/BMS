import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';
import { Amenity } from './entities/amenity.entity';
import { BuildingAmenity } from './entities/building-amenity.entity';
import { UnitAmenity } from './entities/unit-amenity.entity';
import { Building } from '../buildings/entities/building.entity';
import { Unit } from '../units/entities/unit.entity';
import { Owner } from '../owners/entities/owner.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Amenity,
      BuildingAmenity,
      UnitAmenity,
      Building,
      Unit,
      Owner,
      UserRole,
    ]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
})
export class AmenitiesModule {}
