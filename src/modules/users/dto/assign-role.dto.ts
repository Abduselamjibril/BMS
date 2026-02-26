import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 'role-uuid' })
  @IsString()
  @IsNotEmpty()
  role_id: string;
}
