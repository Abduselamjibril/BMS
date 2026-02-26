import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { LoginHistory } from './entities/login-history.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Contractor } from '../maintenance/entities/contractor-and-workorder.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, LoginHistory, Role, UserRole, Contractor])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
