import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString } from 'class-validator';

export class CreateWorkOrderDto {
    @ApiProperty({ description: 'Maintenance Request ID (UUID)', example: 'request-uuid' })
    @IsUUID()
    request_id!: string;

    @ApiProperty({ description: 'Contractor ID (UUID)', example: 'contractor-uuid' })
    @IsUUID()
    contractor_id!: string;

    @ApiProperty({ description: 'Scheduled date for the work', example: '2026-03-01' })
    @IsDateString()
    scheduled_date!: string;
}
