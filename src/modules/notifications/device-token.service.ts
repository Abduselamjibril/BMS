import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDeviceToken } from './entities/user-device-token.entity';

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectRepository(UserDeviceToken)
    private readonly userDeviceTokenRepo: Repository<UserDeviceToken>,
  ) {}

  async registerDevice(user_id: string, fcm_token: string, device_type: string) {
    let token = await this.userDeviceTokenRepo.findOne({ where: { fcm_token } });
    if (!token) {
      token = this.userDeviceTokenRepo.create({
        user_id,
        fcm_token,
        device_type,
        last_used: new Date(),
      });
    } else {
      token.last_used = new Date();
      token.device_type = device_type;
      token.user_id = user_id;
    }
    await this.userDeviceTokenRepo.save(token);
    return { registered: true };
  }

  async unregisterDevice(fcm_token: string) {
    await this.userDeviceTokenRepo.delete({ fcm_token });
    return { unregistered: true };
  }

  async getTokensByUser(user_id: string) {
    const tokens = await this.userDeviceTokenRepo.find({ where: { user_id } });
    return tokens.map(t => t.fcm_token);
  }
}
