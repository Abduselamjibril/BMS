import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSettings } from './entities/organization-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(OrganizationSettings)
    private readonly settingsRepo: Repository<OrganizationSettings>,
  ) {}

  async getSettings(): Promise<OrganizationSettings | null> {
    return this.settingsRepo.findOne({});
  }

  async updateSettings(dto: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    let settings = await this.settingsRepo.findOne({});
    if (!settings) {
      settings = this.settingsRepo.create(dto);
    } else {
      Object.assign(settings, dto);
    }
    return this.settingsRepo.save(settings);
  }
}
