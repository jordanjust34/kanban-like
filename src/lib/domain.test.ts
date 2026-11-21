import { describe, expect, it } from 'vitest';
import { isPriority, isStatus, STATUSES } from './domain';

describe('domain', () => {
  it('keeps the four board columns in order', () => {
    expect(STATUSES.map((s) => s.value)).toEqual(['todo', 'in_progress', 'in_review', 'done']);
  });
  it('guards status and priority values', () => {
    expect(isStatus('in_review')).toBe(true);
    expect(isStatus('archived')).toBe(false);
    expect(isPriority('high')).toBe(true);
    expect(isPriority('urgent')).toBe(false);
  });
});
