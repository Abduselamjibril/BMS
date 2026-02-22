import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'view_building' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Allows viewing building details' })
  @IsString()
  description?: string;
}
