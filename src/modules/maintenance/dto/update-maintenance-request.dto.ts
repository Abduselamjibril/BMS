import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MaintenanceStatus } from '../entities/maintenance-request.entity';

export class UpdateMaintenanceRequestDto {
  @ApiProperty({
    description: 'Updated description',
    example: 'Updated description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Updated priority',
    example: 'medium',
    required: false,
  })
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiProperty({
    enum: MaintenanceStatus,
    description: 'Updated status',
    example: 'CANCELLED',
    required: false,
  })
  @IsEnum(MaintenanceStatus)
  @IsOptional()
  status?: MaintenanceStatus;
}
