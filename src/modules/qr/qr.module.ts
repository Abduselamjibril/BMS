import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QRCode } from './entities/qr-code.entity';
import { QRScanLog } from './entities/qr-scan-log.entity';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { Unit } from '../units/entities/unit.entity';
import { Building } from '../buildings/entities/building.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QRCode, QRScanLog, Unit, Building, UserRole])],
  providers: [QrService],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
