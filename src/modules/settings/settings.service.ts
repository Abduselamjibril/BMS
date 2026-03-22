import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { writeFileSync } from 'fs';
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
    return this.settingsRepo.findOne({ where: {} });
  }

  async updateSettings(
    dto: Partial<OrganizationSettings>,
    logo?: Express.Multer.File,
  ): Promise<OrganizationSettings> {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (logo) {
      // Save the file to a static directory (e.g., public/logos)
      const logoDir = join(process.cwd(), 'public', 'logos');
      const fs = require('fs');
      if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
      // Replace spaces with dashes in the filename
      const safeName = logo.originalname.replace(/\s+/g, '-');
      const filePath = join(logoDir, safeName);
      writeFileSync(filePath, logo.buffer);
      dto.logo_path = `/static/logos/${safeName}`;
    }
    if (!settings) {
      settings = this.settingsRepo.create(dto);
    } else {
      Object.assign(settings, dto);
    }
    return this.settingsRepo.save(settings);
  }
}
