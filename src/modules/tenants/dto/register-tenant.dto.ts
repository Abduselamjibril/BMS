import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { TenantStatus, TenantType } from '../entities/tenant.entity';

export class RegisterTenantDto {
  @ApiProperty({ example: 'Abel' })
  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @ApiProperty({ example: 'Kebede' })
  @IsString()
  @IsNotEmpty()
  last_name!: string;

  @ApiProperty({ example: '+251911000000' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'tenant@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: '0000011037' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'TIN number must be exactly 10 digits' })
  tin_number?: string;

  @ApiProperty({ required: false, example: 'VAT-1234' })
  @IsOptional()
  @IsString()
  vat_reg_number?: string;

  @ApiProperty({
    enum: TenantStatus,
    required: false,
    default: TenantStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiProperty({ enum: TenantType, required: false, default: TenantType.PERSONAL })
  @IsOptional()
  @IsEnum(TenantType)
  tenant_type?: TenantType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id_image?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  detailed_address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  license_image?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profile_image?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tin_certificate_image?: string;
}
