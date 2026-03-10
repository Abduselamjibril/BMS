import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class SubmitFeedbackDto {
    @ApiProperty({ description: 'Work Order ID (UUID)', example: 'workorder-uuid' })
    @IsUUID()
    work_order_id!: string;

    @ApiProperty({ description: 'Tenant ID (UUID)', example: 'tenant-uuid' })
    @IsUUID()
    tenant_id!: string;

    @ApiProperty({ description: 'Rating from 1 to 5', example: 5 })
    @IsNumber()
    @Min(1)
    @Max(5)
    rating!: number;

    @ApiProperty({ description: 'Optional comment', example: 'Great job, quick fix!', required: false })
    @IsString()
    @IsOptional()
    comment?: string;
}
