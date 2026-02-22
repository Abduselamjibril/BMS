import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/modules/users/entities/user.entity';
import { Role } from './src/modules/roles/entities/role.entity';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepo = app.get(getRepositoryToken(User));
  const roleRepo = app.get(getRepositoryToken(Role));

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperSecure123!';

  // Check if super admin already exists
  const existing = await userRepo.findOne({ where: { email: superAdminEmail } });
  if (existing) {
    console.log('Super admin already exists:', superAdminEmail);
    await app.close();
    return;
  }

  // Ensure SUPER_ADMIN role exists
  let superAdminRole = await roleRepo.findOne({ where: { name: 'super_admin' } });
  if (!superAdminRole) {
    superAdminRole = await roleRepo.save({ name: 'super_admin', description: 'System Super Admin', type: 'system' });
  }

  const password_hash = await bcrypt.hash(superAdminPassword, 10);
  const user = userRepo.create({
    name: 'Super Admin',
    email: superAdminEmail,
    password_hash,
    role: 'super_admin',
    is_active: true,
  });
  await userRepo.save(user);
  console.log('Seeded super admin:', superAdminEmail, 'Password:', superAdminPassword);
  await app.close();
}

bootstrap();
