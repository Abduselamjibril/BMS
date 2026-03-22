import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsEnum } from 'class-validator';

export class CreateMaintenanceRequestDto {
  @ApiProperty({ description: 'Unit ID (UUID)', example: 'unit-uuid' })
  @IsUUID()
  unit_id!: string;

  @ApiProperty({ description: 'Tenant ID (UUID)', example: 'tenant-uuid' })
  @IsUUID()
  tenant_id!: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'Leaking faucet in kitchen',
  })
  @IsString()
  description!: string;

  @ApiProperty({ description: 'Priority level', example: 'high' })
  @IsString()
  priority!: string;

  @ApiProperty({ description: 'Category of maintenance', example: 'plumbing' })
  @IsString()
  category!: string;
}
