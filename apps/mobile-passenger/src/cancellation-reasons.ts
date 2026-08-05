export const PASSENGER_CANCELLATION_REASONS = [
  { value: 'changed_plans', label: 'I changed my plans' },
  { value: 'driver_too_far', label: 'Driver is too far away' },
  { value: 'long_wait', label: 'Wait time is too long' },
  { value: 'wrong_pickup', label: 'Pickup location is incorrect' },
  { value: 'other', label: 'Other reason' },
] as const;

export type PassengerCancellationReason = (typeof PASSENGER_CANCELLATION_REASONS)[number]['value'];

export function cancellationReasonLabel(value: PassengerCancellationReason): string {
  return PASSENGER_CANCELLATION_REASONS.find((reason) => reason.value === value)?.label || 'Other reason';
}
