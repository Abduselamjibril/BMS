import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTenantApplicationDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty()
  @IsUUID()
  unit_id!: string;

  @ApiProperty()
  @IsUUID()
  building_id!: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  @IsNotEmpty()
  move_in_date!: string;
}
