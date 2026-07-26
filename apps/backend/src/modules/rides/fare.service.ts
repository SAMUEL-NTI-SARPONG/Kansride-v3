import { Injectable } from '@nestjs/common';
import {
  FARE_BASE_PESEWAS,
  FARE_PER_KM_PESEWAS,
  FARE_PER_MINUTE_PESEWAS,
  FARE_MINIMUM_PESEWAS,
} from '@kansride/config';
import type { RideType } from '@kansride/types';

@Injectable()
export class FareService {
  private readonly BASE = FARE_BASE_PESEWAS;
  private readonly PER_KM = FARE_PER_KM_PESEWAS;
  private readonly PER_MIN = FARE_PER_MINUTE_PESEWAS;
  private readonly MINIMUM = FARE_MINIMUM_PESEWAS;

  calculateFare(
    distanceMeters: number,
    durationSeconds: number,
    rideType: RideType = 'standard_tricycle',
  ): {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    totalFare: number;
  } {
    const distanceKm = distanceMeters / 1000;
    const durationMin = durationSeconds / 60;

    const baseFare = this.BASE;
    const distanceFare = Math.ceil(distanceKm * this.PER_KM);
    const timeFare = Math.ceil(durationMin * this.PER_MIN);

    let totalFare = baseFare + distanceFare + timeFare;

    // Apply minimum fare
    totalFare = Math.max(totalFare, this.MINIMUM);

    // Priority rides have 1.5x multiplier
    if (rideType === 'priority_tricycle') {
      totalFare = Math.ceil(totalFare * 1.5);
    }

    return { baseFare, distanceFare, timeFare, totalFare };
  }
}
