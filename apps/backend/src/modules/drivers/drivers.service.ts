import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  async register(data: { licenseNumber: string; vehicleRegistration: string }) {
    this.logger.log(`Driver registration: ${data.licenseNumber}`);
    // TODO: Insert into DB
    return { message: 'Registration submitted for review', status: 'pending' };
  }

  async setOnlineStatus(online: boolean, location?: { latitude: number; longitude: number }) {
    // TODO: Update driver status in DB + Redis
    return { online, location };
  }

  async subscribe(paymentMethod: string) {
    // TODO: Initiate subscription payment
    return { message: 'Subscription initiated', amountPesewas: 1000, method: paymentMethod };
  }

  async getEarnings() {
    // TODO: Aggregate from rides
    return { today: 0, thisWeek: 0, totalRides: 0 };
  }
}
