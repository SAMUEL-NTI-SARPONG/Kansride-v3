import { Injectable } from '@nestjs/common';
import {
  FARE_BASE_PESEWAS,
  FARE_PER_KM_PESEWAS,
  FARE_PER_MINUTE_PESEWAS,
  FARE_MINIMUM_PESEWAS,
} from '@kansride/config';
import type { FareBreakdown, RideType } from '@kansride/types';

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
  ): FareBreakdown {
    const distanceKm = distanceMeters / 1000;
    const durationMin = durationSeconds / 60;

    const baseFarePesewas = this.BASE;
    const distanceFarePesewas = Math.ceil(distanceKm * this.PER_KM);
    const timeFarePesewas = Math.ceil(durationMin * this.PER_MIN);

    let totalFarePesewas =
      baseFarePesewas + distanceFarePesewas + timeFarePesewas;

    // Apply minimum fare
    totalFarePesewas = Math.max(totalFarePesewas, this.MINIMUM);

    // Priority rides have 1.5x multiplier
    if (rideType === 'priority_tricycle') {
      totalFarePesewas = Math.ceil(totalFarePesewas * 1.5);
    }

    return {
      baseFarePesewas,
      distanceFarePesewas,
      timeFarePesewas,
      totalFarePesewas,
    };
  }
}
