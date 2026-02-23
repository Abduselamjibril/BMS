import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { Building } from './entities/building.entity';
import { BuildingAdminAssignment } from './entities/building-admin-assignment.entity';
import { Unit } from '../units/entities/unit.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { Owner } from '../owners/entities/owner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Building, BuildingAdminAssignment, Unit, User, Site, Owner])],
  controllers: [BuildingsController],
  providers: [BuildingsService],
})
export class BuildingsModule {}
