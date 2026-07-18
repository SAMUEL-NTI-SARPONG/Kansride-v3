import { Injectable, BadRequestException } from '@nestjs/common';
import { VALID_RIDE_TRANSITIONS, RideTransition } from '@kansride/config';
import type { RideStatus } from '@kansride/types';

@Injectable()
export class StateMachineService {
  validateTransition(currentStatus: string, nextStatus: string, actor: string): void {
    const transitions = VALID_RIDE_TRANSITIONS[currentStatus as RideStatus];

    if (!transitions) {
      throw new BadRequestException(`Unknown ride status: ${currentStatus}`);
    }

    if (transitions.length === 0) {
      throw new BadRequestException(
        `Ride in terminal state "${currentStatus}" cannot transition to any other state`,
      );
    }

    const validTransition = transitions.find((t: RideTransition) => t.nextStates.includes(nextStatus as RideStatus));

    if (!validTransition) {
      throw new BadRequestException(
        `Invalid transition from "${currentStatus}" to "${nextStatus}"`,
      );
    }

    if (!validTransition.allowedActors.includes(actor)) {
      throw new BadRequestException(
        `Actor "${actor}" is not allowed to transition from "${currentStatus}" to "${nextStatus}". Allowed: ${validTransition.allowedActors.join(', ')}`,
      );
    }
  }

  getValidNextStates(currentStatus: string): string[] {
    const transitions = VALID_RIDE_TRANSITIONS[currentStatus as RideStatus];
    if (!transitions) return [];
    return transitions.flatMap((t: RideTransition) => t.nextStates);
  }
}
