import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

export class UploadTenantDocumentDto {
  @ApiProperty({ description: 'Tenant ID (UUID)', example: 'tenant-uuid' })
  @IsUUID()
  tenant_id!: string;

  @ApiProperty({
    description: 'Document type (e.g. PRIMARY_ID, LEASE)',
    example: 'PRIMARY_ID',
  })
  @IsString()
  type!: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Document file',
  })
  @IsOptional()
  file!: any;
}
