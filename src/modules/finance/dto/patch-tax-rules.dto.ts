import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class PatchTaxRulesDto {
  @ApiProperty({ description: 'VAT rate', example: 0.15, required: true })
  @IsNumber()
  vat_rate!: number;

  @ApiProperty({ description: 'Withholding rate', example: 0.02, required: true })
  @IsNumber()
  withholding_rate!: number;
}
