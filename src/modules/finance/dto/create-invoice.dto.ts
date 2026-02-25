import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsNumber, IsEnum, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceItemType } from '../entities/invoice-item.entity';

export class CreateInvoiceItemDto {
  @ApiProperty({ enum: InvoiceItemType })
  @IsEnum(InvoiceItemType)
  type!: InvoiceItemType;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty({ required: false })
  @IsString()
  description?: string;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  lease_id!: string;

  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty()
  @IsUUID()
  unit_id!: string;

  @ApiProperty()
  @IsDateString()
  due_date!: string;

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}
