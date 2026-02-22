import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { RoleName, RoleType } from '../entities/role.entity';

export class CreateRoleDto {
  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  name: RoleName;

  @ApiProperty({ enum: RoleType })
  @IsEnum(RoleType)
  type: RoleType;

  @ApiProperty({ example: 'Role for company admins' })
  @IsString()
  @IsNotEmpty()
  description?: string;
}
