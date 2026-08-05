import { describe, expect, it } from 'vitest';
import { cancellationReasonLabel, PASSENGER_CANCELLATION_REASONS } from '../src/cancellation-reasons';

describe('passenger cancellation reasons', () => {
  it('provides a non-empty curated reason list', () => {
    expect(PASSENGER_CANCELLATION_REASONS.length).toBeGreaterThanOrEqual(4);
    expect(PASSENGER_CANCELLATION_REASONS.every((reason) => reason.value && reason.label)).toBe(true);
  });

  it('maps canonical reason values to backend-safe labels', () => {
    expect(cancellationReasonLabel('changed_plans')).toBe('I changed my plans');
    expect(cancellationReasonLabel('other')).toBe('Other reason');
  });
});
