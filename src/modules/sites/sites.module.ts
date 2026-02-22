import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { Site } from './entities/site.entity';
import { Building } from '../buildings/entities/building.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Site, Building])],
  controllers: [SitesController],
  providers: [SitesService],
})
export class SitesModule {}
