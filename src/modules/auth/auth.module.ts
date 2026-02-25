import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { LoginHistory } from '../users/entities/login-history.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { Permission } from '../roles/entities/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoginHistory, UserRole, RolePermission, Permission]),
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
