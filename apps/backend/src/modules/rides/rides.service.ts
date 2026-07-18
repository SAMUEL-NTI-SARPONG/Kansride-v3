import { Injectable, BadRequestException, Logger } from '@nestjs/common';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  async createRide(passengerId: string, data: any) {
    this.logger.log(`Ride requested by ${passengerId}`);
    // TODO: Create ride in DB, trigger dispatch
    return {
      id: 'ride-placeholder-id',
      passengerId,
      status: 'requested',
      estimatedFarePesewas: 800,
      ...data,
    };
  }

  async getRide(id: string) {
    // TODO: Fetch from DB
    return { id, status: 'requested', estimatedFarePesewas: 800 };
  }

  async cancelRide(id: string, userId: string, reason?: string) {
    // TODO: Validate state transition, update DB
    return { id, status: 'cancelled_by_passenger', cancelledBy: userId, reason };
  }

  async updateStatus(id: string, newStatus: string) {
    // TODO: Validate via ride-transitions state machine
    return { id, status: newStatus };
  }

  async rateRide(id: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) throw new BadRequestException('Rating must be 1-5');
    return { id, rating, comment };
  }
}
