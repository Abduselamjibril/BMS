import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { Owner } from './entities/owner.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Owner, User, Role, UserRole])],
  controllers: [OwnersController],
  providers: [OwnersService],
})
export class OwnersModule {}
