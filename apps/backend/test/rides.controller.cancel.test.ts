import { describe, expect, it, vi } from 'vitest';
import { RidesController } from '../src/modules/rides/rides.controller';

const RIDE_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';

describe('RidesController cancellation body', () => {
  it('forwards an absent body as an undefined reason', async () => {
    const ridesService = { cancelRide: vi.fn().mockResolvedValue({ id: RIDE_ID }) };
    const controller = new RidesController(ridesService as never, {} as never);

    await controller.cancelRide(RIDE_ID, { user: { userId: USER_ID, role: 'passenger' } } as never, undefined);

    expect(ridesService.cancelRide).toHaveBeenCalledWith(RIDE_ID, USER_ID, 'passenger', undefined);
  });
});
