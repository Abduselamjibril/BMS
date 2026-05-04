import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/modules/users/entities/user.entity';
import { Tenant } from './src/modules/tenants/entities/tenant.entity';
import { Lease } from './src/modules/leases/entities/lease.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const uRepo = app.get(getRepositoryToken(User));
  const tRepo = app.get(getRepositoryToken(Tenant));
  const lRepo = app.get(getRepositoryToken(Lease));

  const u = await uRepo.findOne({ where: { email: 'pog@gmail.com' } });
  if (u) {
    console.log('User ID: ' + u.id);
    const t = await tRepo.findOne({ where: { user: { id: u.id } } });
    if (t) {
      console.log('Tenant ID: ' + t.id);
      const ls = await lRepo.find({ where: { tenant: { id: t.id } }, relations: ['unit'] });
      ls.forEach(l => console.log('Lease Status: ' + l.status + ', Unit: ' + l.unit?.unit_number + ' (ID: ' + l.unit?.id + ')'));
    } else {
      console.log('No tenant profile found for this user.');
    }
  } else {
    console.log('User not found.');
  }

  await app.close();
}

bootstrap();
