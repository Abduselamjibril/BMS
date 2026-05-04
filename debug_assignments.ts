import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Site } from './src/modules/sites/entities/site.entity';
import { BuildingAdminAssignment } from './src/modules/buildings/entities/building-admin-assignment.entity';
import { User } from './src/modules/users/entities/user.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const siteRepo = app.get<Repository<Site>>(getRepositoryToken(Site));
  const adminRepo = app.get<Repository<BuildingAdminAssignment>>(getRepositoryToken(BuildingAdminAssignment));
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

  const sites = await siteRepo.find({ relations: ['manager'] });
  console.log('--- SITES ---');
  sites.forEach(s => {
    console.log(`Site: ${s.name}, Manager: ${s.manager?.email || 'NONE'}`);
  });

  const assignments = await adminRepo.find({ relations: ['user', 'building'] });
  console.log('\n--- BUILDING ASSIGNMENTS ---');
  assignments.forEach(a => {
    console.log(`User: ${a.user?.email}, Building: ${a.building?.name}, Status: ${a.status}`);
  });

  await app.close();
}

bootstrap();
