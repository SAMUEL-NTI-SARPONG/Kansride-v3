import { describe, expect, it } from 'vitest';
import { subscriptionError } from '../src/api/subscription-protocol';

const RIDE_ID = '00000000-0000-0000-0000-000000000001';

describe('passenger ride subscription acknowledgement protocol', () => {
  it('accepts only the matching backend acknowledgement', () => {
    expect(subscriptionError(RIDE_ID, { event: 'ack', data: { subscribed: RIDE_ID } })).toBeNull();
  });

  it('rejects backend authorization errors and mismatched acknowledgements', () => {
    expect(subscriptionError(RIDE_ID, { event: 'error', data: { message: 'Ride subscription not authorized' } })?.message).toMatch(/not authorized/);
    expect(subscriptionError(RIDE_ID, { event: 'ack', data: { subscribed: 'other' } })?.message).toMatch(/not authorized/);
    expect(subscriptionError(RIDE_ID, undefined)?.message).toMatch(/not authorized/);
  });
});
