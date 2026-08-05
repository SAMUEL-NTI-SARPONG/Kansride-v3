export interface SubscriptionResponse {
  event?: 'ack' | 'error';
  data?: { subscribed?: string; message?: string };
}

export function subscriptionError(
  rideId: string,
  response: SubscriptionResponse | undefined,
): Error | null {
  if (response?.event === 'ack' && response.data?.subscribed === rideId) return null;
  return new Error(response?.data?.message || 'Ride subscription was not authorized');
}

export const SUBSCRIPTION_ACK_TIMEOUT_MS = 10_000;
