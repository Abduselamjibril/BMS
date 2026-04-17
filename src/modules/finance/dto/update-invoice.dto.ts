import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceItemDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
  @ApiProperty()
  @IsDateString()
  due_date!: string;

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}
