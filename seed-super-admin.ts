import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/modules/users/entities/user.entity';
import { Role } from './src/modules/roles/entities/role.entity';
import { UserRole } from './src/modules/roles/entities/user-role.entity';
import * as bcrypt from 'bcryptjs';
import { webcrypto } from 'node:crypto';

// Node 18 containers may not expose global crypto by default; Nest Schedule expects it.
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
    { name: 'contractor', description: 'Contractor', type: 'system' },
    { name: 'tenant', description: 'Default Tenant Role', type: 'system' },
    { name: 'finance', description: 'Finance Controller', type: 'system' },
    { name: 'owner', description: 'Building Owner', type: 'system' },
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
    { code: 'visitors:checkout', description: 'Checkout visitors' },
    { code: 'owners:create', description: 'Create owners' },
    { code: 'owners:read', description: 'Read owners' },
    { code: 'owners:update', description: 'Update owners' },
    { code: 'owners:delete', description: 'Delete owners' },
    { code: 'utilities:meters:create', description: 'Create meters' },
    { code: 'utilities:meters:read', description: 'Read meters' },
    { code: 'utilities:readings:create', description: 'Create meter readings' },
    { code: 'utilities:readings:read', description: 'Read meter readings' },
    { code: 'reports:view', description: 'View reports' },
    // Reports
    { code: 'reports:dashboard', description: 'View management dashboard KPIs' },
    { code: 'reports:financial', description: 'View financial reports' },
    { code: 'reports:occupancy', description: 'View occupancy reports' },
    // Sites management
    { code: 'sites:create', description: 'Create sites' },
    { code: 'sites:read', description: 'Read sites' },
    { code: 'sites:update', description: 'Update sites' },
    { code: 'sites:delete', description: 'Delete sites' },
    // Tenant applications / documents / announcements
    { code: 'applications:review', description: 'Review tenant applications' },
    { code: 'applications:approve', description: 'Approve tenant applications and create draft leases' },
    { code: 'applications:reject', description: 'Reject tenant applications' },
    { code: 'documents:verify', description: 'Verify or reject tenant documents' },
    { code: 'announcements:create', description: 'Create announcements' },
    // Building management
    { code: 'buildings:create', description: 'Create buildings' },
    { code: 'buildings:read', description: 'Read buildings' },
    { code: 'buildings:update', description: 'Update buildings' },
    { code: 'buildings:delete', description: 'Delete buildings' },
    { code: 'buildings:assign_admin', description: 'Assign admin to building' },
    { code: 'buildings:revoke_admin', description: 'Revoke admin from building' },
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
    { code: 'qr:generate', description: 'Generate QR token' },
    { code: 'qr:analytics', description: 'View QR analytics' },
    { code: 'qr:deactivate', description: 'Deactivate QR codes' },
    { code: 'qr:export_pdf', description: 'Export QR codes to PDF' },
    // Messaging
    { code: 'messages:send', description: 'Send messages to tenant' },
    { code: 'tenants:read', description: 'Read tenant profiles' },
    // Units management
    { code: 'units:create', description: 'Create units' },
    { code: 'units:read', description: 'Read units' },
    { code: 'units:update', description: 'Update units' },
    { code: 'units:delete', description: 'Delete units' },
    { code: 'units:bulk_upload', description: 'Bulk upload units' },
    { code: 'units:amenities_link', description: 'Link amenity to unit' },
    { code: 'units:amenities_remove', description: 'Remove amenity from unit' },
    // Amenities management
    { code: 'amenities:create', description: 'Create amenities' },
    { code: 'amenities:read', description: 'Read amenities' },
    { code: 'amenities:update', description: 'Update amenities' },
    { code: 'amenities:delete', description: 'Delete amenities' },
    { code: 'amenities:link_building', description: 'Link amenity to building' },
    { code: 'amenities:remove_building', description: 'Remove amenity from building' },
    { code: 'amenities:link_unit', description: 'Link amenity to unit' },
    { code: 'amenities:remove_unit', description: 'Remove amenity from unit' },
    // Lease management
    { code: 'leases:create', description: 'Create lease draft' },
    { code: 'leases:activate', description: 'Activate lease' },
    { code: 'leases:terminate', description: 'Terminate lease' },
    { code: 'leases:renew', description: 'Renew lease' },
    // Finance
    { code: 'finance:invoices:create', description: 'Create invoices' },
    { code: 'finance:invoices:all', description: 'List all invoices (admin)' },
    { code: 'finance:payments:verify', description: 'Verify payments' },
    { code: 'finance:tax_rules:update', description: 'Update tax rules' },
    { code: 'finance:invoices:void', description: 'Void invoices' },
    { code: 'finance:bank_accounts:create', description: 'Create bank accounts' },
    { code: 'finance:invoices:generate', description: 'Trigger invoice generation' },
    { code: 'finance:reports:revenue', description: 'View revenue reports' },
    { code: 'finance:reports:tax', description: 'View tax reports' },
    // Documents
    { code: 'documents:delete', description: 'Soft delete documents' },
    { code: 'documents:history', description: 'View document version history' },
    { code: 'documents:search', description: 'Search documents across modules' },
    { code: 'documents:upload', description: 'Upload documents' },
    { code: 'settings:read', description: 'Read organization settings' },
    { code: 'settings:update', description: 'Update organization settings' },
    // Maintenance
    { code: 'maintenance:requests:create', description: 'Submit maintenance requests' },
    { code: 'maintenance:requests:read', description: 'Read maintenance requests' },
    { code: 'maintenance:requests:update', description: 'Edit/cancel maintenance requests' },
    { code: 'maintenance:work_orders:create', description: 'Create work orders from requests' },
    { code: 'maintenance:work_orders:update', description: 'Update work order status (contractor)' },
    { code: 'maintenance:feedback:create', description: 'Submit feedback for work orders' },
    { code: 'maintenance:reports:read', description: 'Read maintenance KPIs and contractor performance' },
    // Assets & Inventory
    { code: 'assets:create', description: 'Log property assets' },
    { code: 'assets:read', description: 'Read property assets' },
    { code: 'assets:update', description: 'Update asset details' },
    { code: 'assets:delete', description: 'Delete asset from inventory' },
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
      console.warn('Could not seed permission:', p.code, getErrorMessage(e));
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
        'visitors:create','visitors:read','visitors:update','visitors:delete','visitors:checkout','utilities:meters:create','utilities:meters:read','utilities:readings:read',
        'owners:create','owners:read','owners:update',
        'buildings:create','buildings:read','buildings:update',
        'sites:create','sites:read','sites:update','sites:delete',
        'leases:create','leases:activate','leases:terminate','leases:renew',
        'finance:invoices:create','finance:invoices:all','finance:payments:verify','finance:tax_rules:update','finance:invoices:void','finance:bank_accounts:create','finance:invoices:generate','finance:reports:revenue','finance:reports:tax',
        'documents:delete','documents:history','documents:search',
        'applications:review','applications:approve','applications:reject','documents:verify','announcements:create',
        'units:create','units:read','units:update','units:delete','units:bulk_upload','units:amenities_link','units:amenities_remove',
        'amenities:create','amenities:read','amenities:update','amenities:delete','amenities:link_building','amenities:remove_building','amenities:link_unit','amenities:remove_unit',
        'reports:view','reports:dashboard','reports:financial','reports:occupancy',
        'reports:revenue','reports:maintenance','reports:utility',
        'maintenance:requests:create','maintenance:requests:read','maintenance:requests:update','maintenance:work_orders:create','maintenance:work_orders:update','maintenance:feedback:create','maintenance:reports:read',
        'qr:generate','qr:analytics','qr:deactivate','qr:export_pdf',
        'settings:read','settings:update',
        'assets:create', 'assets:read', 'assets:update', 'assets:delete',
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
        'users:read',
        'visitors:create','visitors:read','visitors:update','visitors:delete',
        'reports:view','reports:dashboard','reports:financial','reports:occupancy','reports:revenue','reports:maintenance','reports:utility',
        'owners:read',
        'buildings:read',
        'sites:read','sites:update',
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
    // Map permissions for contractor role
    const contractorRole = await roleRepo.findOne({ where: { name: 'contractor' } });
    if (contractorRole) {
      const contractorPermCodes = [
        'maintenance:work_orders:update',
        'maintenance:requests:read',
        'tenants:read',
        'units:read',
        'buildings:read',
        'sites:read'
      ];
      for (const code of contractorPermCodes) {
        const p = allPerms.find((x) => x.code === code);
        if (p) {
          const exists = await rolePermRepo.findOne({ where: { role: { id: contractorRole.id }, permission: { id: p.id } } });
          if (!exists) await rolePermRepo.save({ role: contractorRole, permission: p });
        }
      }
      console.log('Mapped default contractor permissions');
    }

    // Map permissions for tenant role
    const tenantRoleSeed = await roleRepo.findOne({ where: { name: 'tenant' } });
    if (tenantRoleSeed) {
      const tenantPermCodes = [
        'maintenance:requests:create',
        'maintenance:requests:read',
        'maintenance:requests:update',
        'maintenance:feedback:create',
        'tenants:read',
        'units:read',
        'buildings:read',
        'documents:history',
        'documents:upload',
        'documents:search',
        'messages:send',
        'applications:review',
        'finance:invoices:read',
        'finance:payments:create',
        'visitors:read',
        'visitors:create',
        'utilities:meters:read',
        'utilities:readings:read',
        'sites:read',
      ];
      for (const code of tenantPermCodes) {
        const p = allPerms.find((x) => x.code === code);
        if (p) {
          const exists = await rolePermRepo.findOne({ where: { role: { id: tenantRoleSeed.id }, permission: { id: p.id } } });
          if (!exists) await rolePermRepo.save({ role: tenantRoleSeed, permission: p });
        }
      }
      console.log('Mapped default tenant permissions');
    }

    // Map permissions for finance role
    const financeRoleSeed = await roleRepo.findOne({ where: { name: 'finance' } });
    if (financeRoleSeed) {
      const financePermCodes = [
        'finance:invoices:create',
        'finance:invoices:all',
        'finance:payments:verify',
        'finance:tax_rules:update',
        'finance:invoices:void',
        'finance:bank_accounts:create',
        'finance:invoices:generate',
        'finance:reports:revenue',
        'finance:reports:tax',
        'finance:ledger:read',
        'finance:analytics:read',
        'finance:invoices:resend',
        'finance:invoices:manage',
        'finance:bank_accounts:read',
        'finance:bank_accounts:update',
        'finance:bank_accounts:delete',
        'finance:deposit_advice:read',
        'finance:deposit_advice:verify',
        'finance:expenses:create',
        'finance:expenses:read',
        'finance:reports:p-and-l',
        'reports:financial',
        'reports:view'
      ];
      for (const code of financePermCodes) {
        const p = allPerms.find((x) => x.code === code);
        if (p) {
          const exists = await rolePermRepo.findOne({ where: { role: { id: financeRoleSeed.id }, permission: { id: p.id } } });
          if (!exists) await rolePermRepo.save({ role: financeRoleSeed, permission: p });
        }
      }
      console.log('Mapped default finance permissions');
    }

    // Map permissions for owner role
    const ownerRoleSeed = await roleRepo.findOne({ where: { name: 'owner' } });
    if (ownerRoleSeed) {
      const ownerPermCodes = [
        // Property (read)
        'owners:read',
        'buildings:read',
        'units:read',
        'sites:read',
        'assets:read',
        'amenities:read',
        // People
        'tenants:read',
        'visitors:read',
        'visitors:create',
        // Leases
        'leases:create',
        'leases:activate',
        'leases:terminate',
        'leases:renew',
        // Finance
        'finance:invoices:create',
        'finance:invoices:all',
        'finance:payments:verify',
        'finance:reports:revenue',
        'finance:reports:tax',
        'finance:bank_accounts:create',
        'finance:invoices:generate',
        // Reports
        'reports:view',
        'reports:dashboard',
        'reports:financial',
        'reports:occupancy',
        // Maintenance (read-only)
        'maintenance:requests:read',
        'maintenance:reports:read',
        // Utilities (read-only)
        'utilities:meters:read',
        'utilities:readings:read',
        // Documents (read-only)
        'documents:history',
        'documents:search',
        // Misc
        'messages:send',
        'announcements:create',
      ];
      for (const code of ownerPermCodes) {
        const p = allPerms.find((x) => x.code === code);
        if (p) {
          const exists = await rolePermRepo.findOne({ where: { role: { id: ownerRoleSeed.id }, permission: { id: p.id } } });
          if (!exists) await rolePermRepo.save({ role: ownerRoleSeed, permission: p });
        }
      }
      console.log('Mapped default owner permissions');
    }
  } catch (e) {
    console.warn('Could not map role permissions:', getErrorMessage(e));
  }

  // --- super_admin seeding ---
  let superAdmin = await userRepo.findOne({ where: { email: superAdminEmail } });
  if (!superAdmin) {
    const password_hash = await bcrypt.hash(superAdminPassword, 10);
    superAdmin = userRepo.create({
      name: 'Super Admin',
      email: superAdminEmail,
      password_hash,
      role: 'super_admin',
      is_active: true,
    });
    await userRepo.save(superAdmin);
    console.log('Seeded super admin:', superAdminEmail);
  }

  // Ensure super_admin role link exists
  if (superAdmin && superAdminRole) {
    const existingUR = await userRoleRepo.findOne({ where: { user: { id: superAdmin.id }, role: { id: superAdminRole.id } } });
    if (!existingUR) {
      await userRoleRepo.save(userRoleRepo.create({ user: superAdmin, role: superAdminRole }));
      console.log('Assigned super_admin role to user');
    }
  }

  // --- Additional Seeded Users for Testing ---
  const extraUsers = [
     { name: 'Organization Admin', email: 'admin@example.com', password: 'Password123!', roleSlug: 'admin' },
    { name: 'Site Admin User', email: 'siteadmin@example.com', password: 'Password123!', roleSlug: 'site_admin' },
    { name: 'Contractor User', email: 'contractor@example.com', password: 'Password123!', roleSlug: 'contractor' },
    { name: 'Tenant User', email: 'tenant@example.com', password: 'Password123!', roleSlug: 'tenant' },
    { name: 'Finance Controller', email: 'finance@example.com', password: 'Password123!', roleSlug: 'finance' },
    { name: 'Building Owner', email: 'owner@example.com', password: 'Password123!', roleSlug: 'owner' },
  ];

  for (const extra of extraUsers) {
    let user = await userRepo.findOne({ where: { email: extra.email } });
    const targetRole = await roleRepo.findOne({ where: { name: extra.roleSlug } });
    const password_hash = await bcrypt.hash(extra.password, 10);

    if (!user) {
      user = userRepo.create({
        name: extra.name,
        email: extra.email,
        password_hash,
        role: extra.roleSlug as any,
        is_active: true,
      });
      await userRepo.save(user);
      console.log(`Seeded user: ${extra.email} (Password: ${extra.password})`);
    } else {
      // Update password if user exists to ensure it matches the user's request
      user.password_hash = password_hash;
      await userRepo.save(user);
      console.log(`Updated password for user: ${extra.email}`);
    }

    // Ensure UserRole link exists
    if (user && targetRole) {
      const existingUR = await userRoleRepo.findOne({
        where: { user: { id: user.id }, role: { id: targetRole.id } }
      });
      if (!existingUR) {
        await userRoleRepo.save(userRoleRepo.create({ user, role: targetRole }));
        console.log(`Assigned ${extra.roleSlug} role to ${extra.email}`);
      }

      // --- Assign building management for demo purposes ---
      if (extra.roleSlug === 'admin' || extra.roleSlug === 'site_admin') {
        const assignmentRepo = app.get(getRepositoryToken(require('./src/modules/buildings/entities/building-admin-assignment.entity').BuildingAdminAssignment));
        const buildingRepo = app.get(getRepositoryToken(require('./src/modules/buildings/entities/building.entity').Building));
        const buildings = await buildingRepo.find();
        
        for (const b of buildings) {
          const exists = await assignmentRepo.findOne({ where: { user: { id: user.id }, building: { id: b.id } } });
          if (!exists) {
            await assignmentRepo.save(assignmentRepo.create({ user, building: b }));
            console.log(`Assigned building ${b.name} to ${extra.email}`);
          }
        }
      }
    }
  }

  await app.close();
}

bootstrap();
