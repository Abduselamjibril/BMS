import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async validateUser(loginDto: LoginDto, ip: string) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === UserStatus.LOCKED) throw new ForbiddenException('Account locked. Contact Super Admin');
    const valid = await bcrypt.compare(loginDto.password, user.password_hash);
    // Account locking logic
    if (!valid) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
      if (user.failed_login_attempts >= 5) {
        user.status = UserStatus.LOCKED;
      }
      await this.usersService.save(user);
      await this.loginHistoryRepo.save({ user, ip_address: ip, success: false });
      throw new UnauthorizedException('Invalid credentials');
    }
    user.failed_login_attempts = 0;
    await this.usersService.save(user);
    await this.loginHistoryRepo.save({ user, ip_address: ip, success: true });
    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
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
