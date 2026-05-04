import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MaintenanceRequest } from './src/modules/maintenance/entities/maintenance-request.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const repo = app.get<Repository<MaintenanceRequest>>(getRepositoryToken(MaintenanceRequest));

  const requests = await repo.find({ 
    relations: ['unit', 'building', 'unit.building'],
    where: [
      { status: 'SUBMITTED' as any },
      { status: 'ASSIGNED' as any },
      { status: 'IN_PROGRESS' as any },
    ]
  });

  console.log('--- PENDING MAINTENANCE ---');
  requests.forEach(r => {
    const bId = r.building?.id || r.unit?.building?.id;
    const bName = r.building?.name || r.unit?.building?.name;
    console.log(`ID: ${r.id}, Status: ${r.status}, Building: ${bName} (${bId})`);
  });

  await app.close();
}

bootstrap();
