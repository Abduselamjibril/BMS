import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
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

  @Get('/alerts/utility-leaks')
  @Permissions('utilities:alerts:read')
  @ApiOperation({
    summary:
      'List units/meters with abnormal utility consumption (possible leaks)',
  })
  async getUtilityLeaks() {
    return this.utilityService.getUtilityLeaks();
  }

  @Post('meters')
  @Permissions('utilities:meters:create')
  @ApiOperation({ summary: 'Link a physical meter to a unit' })
  async createMeter(@Body() dto: CreateMeterDto, @Req() req: any) {
    return this.utilityService.createMeter(dto, req.user);
  }

  @Get('meters')
  @Permissions('utilities:meters:read')
  @ApiOperation({ summary: 'List meters; optional unit_id query' })
  async findMeters(@Req() req: any, @Query('unit_id') unitId?: string) {
    return this.utilityService.findMeters(req.user, unitId);
  }

  @Post('readings')
  @Permissions('utilities:readings:create')
  @ApiOperation({
    summary: 'Record a meter reading (accepts optional photo multipart)',
  })
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
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/meters',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async createReading(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    const dto: CreateReadingDto = {
      meter_id: body.meter_id,
      reading_value:
        body.reading_value !== undefined
          ? Number(body.reading_value)
          : undefined,
      reading_date: body.reading_date,
      photo_url: file ? file.path : body.photo_url,
    } as CreateReadingDto;

    return this.utilityService.createReading(dto, req.user);
  }

  @Get('readings')
  @Permissions('utilities:readings:read')
  @ApiOperation({ summary: 'List readings; optional meter_id query' })
  async findReadings(@Req() req: any, @Query('meter_id') meterId?: string) {
    return this.utilityService.findReadings(req.user, meterId);
  }

  @Get('meters/:id')
  @Permissions('utilities:meters:read')
  @ApiOperation({ summary: 'Get details for a specific meter' })
  async findMeter(@Param('id') id: string) {
    return this.utilityService.findMeter(id);
  }
}
