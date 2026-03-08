import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { RoleType } from '../entities/role.entity';
export class CreateRoleDto {
  @ApiProperty({ example: 'company_admin' })
  @IsString()
  @IsNotEmpty()
  name: string;
  @ApiProperty({ enum: RoleType })
  @IsEnum(RoleType)
  type: RoleType;

  @ApiProperty({ example: 'Role for company admins' })
  @IsString()
  @IsNotEmpty()
  description?: string;
}
