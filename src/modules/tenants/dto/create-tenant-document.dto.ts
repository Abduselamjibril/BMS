import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TenantDocumentType } from '../entities/tenant-document.entity';

export class CreateTenantDocumentDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty({
    enum: TenantDocumentType,
    example: TenantDocumentType.PRIMARY_ID,
  })
  @Transform(({ value }) =>
    value === 'PRIMARY_ID' ? TenantDocumentType.PRIMARY_ID : value,
  )
  @IsEnum(TenantDocumentType)
  type!: TenantDocumentType;

  @ApiProperty({
    example: '/public/tenant-documents/your-file.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  file_url!: string;
}
