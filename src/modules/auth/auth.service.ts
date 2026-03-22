import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserRole } from '../roles/entities/user-role.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { Permission } from '../roles/entities/permission.entity';
import { UsersService } from '../users/users.service';
import { LoginHistory } from '../users/entities/login-history.entity';
import { LoginDto } from '../users/dto/login.dto';
import { UserStatus } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepo: Repository<LoginHistory>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async validateUser(loginDto: LoginDto, ip: string) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === UserStatus.LOCKED)
      throw new ForbiddenException('Account locked. Contact Super Admin');
    const valid = await bcrypt.compare(loginDto.password, user.password_hash);
    // Account locking logic
    if (!valid) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
      if (user.failed_login_attempts >= 5) {
        user.status = UserStatus.LOCKED;
      }
      await this.usersService.save(user);
      await this.loginHistoryRepo.save({
        user,
        ip_address: ip,
        success: false,
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    user.failed_login_attempts = 0;
    await this.usersService.save(user);
    await this.loginHistoryRepo.save({ user, ip_address: ip, success: true });
    return user;
  }

  async login(user: any) {
    // Load roles for this user
    const userRoles = await this.userRoleRepo.find({
      where: { user: { id: user.id } },
      relations: ['role'],
    });
    const roleIds = userRoles.map((ur) => (ur.role as any).id);
    const roleNames = userRoles.map((ur) => (ur.role as any).name);

    // Load permissions assigned to these roles
    let permissionCodes: string[] = [];
    if (roleIds.length > 0) {
      const rolePerms = await this.rolePermissionRepo.find({
        where: { role: { id: In(roleIds) } } as any,
        relations: ['permission'] as any,
      });
      permissionCodes = Array.from(
        new Set(rolePerms.map((rp) => (rp.permission as any).code)),
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      roles: roleNames,
      permissions: permissionCodes,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async refreshToken(user: any) {
    // same enrichment as login
    const userRoles = await this.userRoleRepo.find({
      where: { user: { id: user.id } },
      relations: ['role'],
    });
    const roleIds = userRoles.map((ur) => (ur.role as any).id);
    const roleNames = userRoles.map((ur) => (ur.role as any).name);
    let permissionCodes: string[] = [];
    if (roleIds.length > 0) {
      const rolePerms = await this.rolePermissionRepo.find({
        where: { role: { id: In(roleIds) } } as any,
        relations: ['permission'] as any,
      });
      permissionCodes = Array.from(
        new Set(rolePerms.map((rp) => (rp.permission as any).code)),
      );
    }
    const payload = {
      sub: user.id,
      email: user.email,
      roles: roleNames,
      permissions: permissionCodes,
    };
    return { access_token: this.jwtService.sign(payload) };
  }

  async getProfile(user: any) {
    // Optionally populate permissions here
    return user;
  }

  async getLoginHistory(user: any) {
    return this.loginHistoryRepo.find({
      where: { user: { id: user.id } },
      order: { login_time: 'DESC' },
      take: 20,
    });
  }
}
