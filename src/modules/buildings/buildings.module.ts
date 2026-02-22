import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { Building } from './entities/building.entity';
import { BuildingAdminAssignment } from './entities/building-admin-assignment.entity';
import { Unit } from '../units/entities/unit.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Building, BuildingAdminAssignment, Unit, User])],
  controllers: [BuildingsController],
  providers: [BuildingsService],
})
export class BuildingsModule {}
