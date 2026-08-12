import { describe, expect, it } from 'vitest';
import { resolveAppPort } from '../src/env';

describe('application port resolution', () => {
  it('uses Railway-style PORT when APP_PORT is absent', () => {
    expect(resolveAppPort({ PORT: '8080' })).toBe('8080');
  });

  it('keeps APP_PORT as the explicit override', () => {
    expect(resolveAppPort({ APP_PORT: '3000', PORT: '8080' })).toBe('3000');
  });
});
