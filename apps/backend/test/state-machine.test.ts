import { describe, it, expect } from 'vitest';
import { StateMachineService } from '../src/modules/rides/state-machine.service';
import { BadRequestException } from '@nestjs/common';

describe('StateMachineService.validateTransition', () => {
  const service = new StateMachineService();

  it('accepts an allowed transition with the correct actor', () => {
    expect(() => service.validateTransition('requested', 'searching', 'system')).not.toThrow();
    expect(() => service.validateTransition('in_progress', 'completed', 'driver')).not.toThrow();
    expect(() =>
      service.validateTransition('driver_assigned', 'cancelled_by_passenger', 'passenger'),
    ).not.toThrow();
  });

  it('rejects an invalid destination status with BadRequestException', () => {
    expect(() => service.validateTransition('requested', 'in_progress', 'system')).toThrow(
      BadRequestException,
    );
    expect(() => service.validateTransition('requested', 'in_progress', 'system')).toThrow(
      /Invalid transition/,
    );
  });

  it('rejects a valid transition attempted by an unauthorized actor', () => {
    expect(() => service.validateTransition('requested', 'searching', 'passenger')).toThrow(
      BadRequestException,
    );
    expect(() => service.validateTransition('requested', 'searching', 'passenger')).toThrow(
      /is not allowed/,
    );
  });

  it('rejects every terminal state with a terminal-state message', () => {
    const terminalStates = [
      'cancelled_by_passenger',
      'cancelled_by_driver',
      'cancelled_by_admin',
      'no_driver_found',
      'passenger_no_show',
      'driver_no_show',
      'payment_failed',
      'disputed',
    ];
    for (const state of terminalStates) {
      expect(() => service.validateTransition(state, 'requested', 'system')).toThrow(
        /terminal state/,
      );
    }
  });

  it('rejects an unknown ride status with an unknown-status message', () => {
    expect(() => service.validateTransition('not_a_status', 'requested', 'system')).toThrow(
      /Unknown ride status/,
    );
  });
});

describe('StateMachineService.getValidNextStates', () => {
  const service = new StateMachineService();

  it('returns the flattened set of next states for a non-terminal state', () => {
    const next = new Set(service.getValidNextStates('driver_assigned'));
    expect(next).toContain('driver_en_route');
    expect(next).toContain('cancelled_by_passenger');
    expect(next).toContain('cancelled_by_driver');
    expect(next).toContain('cancelled_by_admin');
  });

  it('returns an empty array for every terminal state', () => {
    expect(service.getValidNextStates('cancelled_by_driver')).toEqual([]);
    expect(service.getValidNextStates('cancelled_by_passenger')).toEqual([]);
    expect(service.getValidNextStates('cancelled_by_admin')).toEqual([]);
    expect(service.getValidNextStates('no_driver_found')).toEqual([]);
    expect(service.getValidNextStates('passenger_no_show')).toEqual([]);
    expect(service.getValidNextStates('driver_no_show')).toEqual([]);
    expect(service.getValidNextStates('payment_failed')).toEqual([]);
    expect(service.getValidNextStates('disputed')).toEqual([]);
  });

  it('returns [] for an unknown status', () => {
    expect(service.getValidNextStates('definitely_not_a_status')).toEqual([]);
  });
});