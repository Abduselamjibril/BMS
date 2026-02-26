import { Controller, Post, Body, Get, Query, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UtilityService } from './utility.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('utilities')
@Controller('utilities')
@Auth()
export class UtilityController {
  constructor(private readonly utilityService: UtilityService) {}

  @Post('meters')
  @Permissions('utilities:meters:create')
  @ApiOperation({ summary: 'Link a physical meter to a unit' })
  createMeter(@Body() dto: CreateMeterDto) {
    return this.utilityService.createMeter(dto);
  }

  @Get('meters')
  @Permissions('utilities:meters:read')
  @ApiOperation({ summary: 'List meters; optional unit_id query' })
  findMeters(@Query('unit_id') unitId?: string) {
    return this.utilityService.findMeters(unitId);
  }

  @Post('readings')
  @ApiOperation({ summary: 'Record a meter reading (accepts optional photo multipart)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        meter_id: { type: 'string', format: 'uuid' },
        reading_value: { type: 'number' },
        reading_date: { type: 'string', format: 'date-time' },
        photo: { type: 'string', format: 'binary' },
      },
      required: ['meter_id', 'reading_value'],
    },
  })
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: './uploads/meters',
      filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}${extname(file.originalname)}`),
    }),
  }))
  async createReading(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: any) {
    const b = body || {};
    const dto: CreateReadingDto = {
      meter_id: b.meter_id,
      reading_value: b.reading_value !== undefined ? Number(b.reading_value) : undefined,
      reading_date: b.reading_date,
      photo_url: file ? file.path : b.photo_url,
    } as any;
    return this.utilityService.createReading(dto);
  }

  @Get('readings')
  @Permissions('utilities:readings:read')
  @ApiOperation({ summary: 'List readings; optional meter_id query' })
  findReadings(@Query('meter_id') meterId?: string) {
    return this.utilityService.findReadings(meterId);
  }
}
