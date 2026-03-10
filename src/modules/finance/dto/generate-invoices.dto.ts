import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class GenerateInvoicesDto {
    @ApiProperty({ description: 'Optional Site ID to filter generation (UUID)', example: 'site-uuid', required: false })
    @IsUUID()
    @IsOptional()
    site_id?: string;

    @ApiProperty({ description: 'Optional Building ID to filter generation (UUID)', example: 'building-uuid', required: false })
    @IsUUID()
    @IsOptional()
    building_id?: string;
}
