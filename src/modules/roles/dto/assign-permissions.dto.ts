import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ type: [String], example: ['permission-uuid-1', 'permission-uuid-2'] })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty({ each: true })
  permissionIds: string[];
}
