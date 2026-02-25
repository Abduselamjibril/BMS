import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/modules/users/entities/user.entity';
import { Role } from './src/modules/roles/entities/role.entity';
import { UserRole } from './src/modules/roles/entities/user-role.entity';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepo = app.get(getRepositoryToken(User));
  const roleRepo = app.get(getRepositoryToken(Role));
  const userRoleRepo = app.get(getRepositoryToken(UserRole));

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperSecure123!';
  // Ensure system roles exist
  const rolesToEnsure = [
    { name: 'super_admin', description: 'System Super Admin', type: 'system' },
    { name: 'admin', description: 'Organization Admin', type: 'system' },
    { name: 'site_admin', description: 'Site-level Admin', type: 'system' },
  ];
  // Ensure Postgres enum type contains our role names (safe: ignore errors)
  try {
    // DataSource is provided by TypeORM in the app context
    const ds = app.get(require('typeorm').DataSource);
    for (const r of rolesToEnsure) {
      try {
        await ds.query(`ALTER TYPE roles_name_enum ADD VALUE '${r.name}'`);
        console.log('Added enum value to roles_name_enum:', r.name);
      } catch (e) {
        // ignore if value already exists or if ALTER fails
      }
    }
  } catch (e) {
    // ignore if DataSource not available or ALTER not permitted in this environment
  }
  for (const r of rolesToEnsure) {
    const found = await roleRepo.findOne({ where: { name: r.name } });
    if (!found) {
      await roleRepo.save(r);
      console.log('Seeded role:', r.name);
    }
  }

  // Re-load the super_admin role for linking
  const superAdminRole = await roleRepo.findOne({ where: { name: 'super_admin' } });

  // Seed permissions and default mappings
  const permissionsToEnsure = [
    { code: 'users:create', description: 'Create users' },
    { code: 'users:read', description: 'Read users' },
    { code: 'users:update', description: 'Update users' },
    { code: 'users:delete', description: 'Delete users' },
    { code: 'visitors:create', description: 'Create visitors' },
    { code: 'visitors:read', description: 'Read visitors' },
    { code: 'visitors:update', description: 'Update visitors' },
    { code: 'visitors:delete', description: 'Delete visitors' },
    { code: 'owners:create', description: 'Create owners' },
    { code: 'owners:read', description: 'Read owners' },
    { code: 'owners:update', description: 'Update owners' },
    { code: 'owners:delete', description: 'Delete owners' },
    { code: 'utilities:meters:create', description: 'Create meters' },
    { code: 'utilities:meters:read', description: 'Read meters' },
    { code: 'utilities:readings:create', description: 'Create meter readings' },
    { code: 'utilities:readings:read', description: 'Read meter readings' },
    { code: 'reports:view', description: 'View reports' },
    // Role & Permission management
    { code: 'roles:create', description: 'Create roles' },
    { code: 'roles:read', description: 'Read roles' },
    { code: 'roles:update', description: 'Update roles' },
    { code: 'roles:delete', description: 'Delete roles' },
    { code: 'roles:assign_permissions', description: 'Assign permissions to roles' },
    { code: 'permissions:create', description: 'Create permissions' },
    { code: 'permissions:read', description: 'Read permissions' },
    { code: 'permissions:delete', description: 'Delete permissions' },
    { code: 'qr:manage', description: 'Manage QR codes' },
  ];

  const permRepo = app.get(getRepositoryToken(require('./src/modules/roles/entities/permission.entity').Permission));
  const rolePermRepo = app.get(getRepositoryToken(require('./src/modules/roles/entities/role-permission.entity').RolePermission));

  for (const p of permissionsToEnsure) {
    try {
      const existingP = await permRepo.findOne({ where: { code: p.code } });
      if (!existingP) {
        await permRepo.save(p);
        console.log('Seeded permission:', p.code);
      }
    } catch (e) {
      console.warn('Could not seed permission:', p.code, e.message || e);
    }
  }

  // Map permissions to roles: super_admin gets all, admin gets most, site_admin scoped
  try {
    const allPerms = await permRepo.find();
    const adminRole = await roleRepo.findOne({ where: { name: 'admin' } });
    const siteAdminRole = await roleRepo.findOne({ where: { name: 'site_admin' } });
    if (superAdminRole) {
      for (const p of allPerms) {
        const exists = await rolePermRepo.findOne({ where: { role: { id: superAdminRole.id }, permission: { id: p.id } } });
        if (!exists) {
          await rolePermRepo.save({ role: superAdminRole, permission: p });
        }
      }
      console.log('Mapped all permissions to super_admin');
    }
    if (adminRole) {
      const adminPermCodes = [
        'users:create','users:read','users:update','users:delete',
        'visitors:read','utilities:meters:read','utilities:readings:read',
        'owners:create','owners:read','owners:update',
        'reports:view',
        // role/permission management (admin-level)
        'roles:read','roles:update','roles:assign_permissions','permissions:read'
      ];
      for (const code of adminPermCodes) {
        const p = allPerms.find((x) => x.code === code);
        if (p) {
          const exists = await rolePermRepo.findOne({ where: { role: { id: adminRole.id }, permission: { id: p.id } } });
          if (!exists) await rolePermRepo.save({ role: adminRole, permission: p });
        }
      }
      console.log('Mapped default admin permissions');
    }
    if (siteAdminRole) {
      const sitePermCodes = [
        'visitors:create','visitors:read','visitors:update','visitors:delete','reports:view',
        'owners:read',
        // limited read access to permissions
        'permissions:read'
      ];
      for (const code of sitePermCodes) {
        const p = allPerms.find((x) => x.code === code);
        if (p) {
          const exists = await rolePermRepo.findOne({ where: { role: { id: siteAdminRole.id }, permission: { id: p.id } } });
          if (!exists) await rolePermRepo.save({ role: siteAdminRole, permission: p });
        }
      }
      console.log('Mapped default site_admin permissions');
    }
  } catch (e) {
    console.warn('Could not map role permissions:', e.message || e);
  }

  // Check if super admin user already exists
  const existing = await userRepo.findOne({ where: { email: superAdminEmail } });
  if (existing) {
    console.log('Super admin already exists:', superAdminEmail);
    // Ensure a UserRole linking the existing user to the SUPER_ADMIN role exists
    try {
      const existingUR = await userRoleRepo.findOne({ where: { user: { id: existing.id }, role: { id: superAdminRole?.id } } });
      if (!existingUR && superAdminRole) {
        const ur = userRoleRepo.create({ user: existing, role: superAdminRole });
        await userRoleRepo.save(ur);
        console.log('Assigned SUPER_ADMIN role to existing user');
      }
    } catch (err) {
      console.warn('Could not ensure user_role link for existing user:', err.message || err);
    }
    await app.close();
    return;
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
  // Ensure a UserRole linking the user to the SUPER_ADMIN role exists
  try {
    const existingUR = await userRoleRepo.findOne({ where: { user: { id: user.id }, role: { id: superAdminRole?.id } } });
    if (!existingUR && superAdminRole) {
      const ur = userRoleRepo.create({ user, role: superAdminRole });
      await userRoleRepo.save(ur);
      console.log('Assigned SUPER_ADMIN role to user');
    }
  } catch (err) {
    console.warn('Could not ensure user_role link:', err.message || err);
  }
  await app.close();
}

bootstrap();
