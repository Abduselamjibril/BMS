import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { OrganizationSettings } from './entities/organization-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationSettings])],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
