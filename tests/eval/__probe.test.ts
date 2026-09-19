import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/lib/stats';

describe('alias probe', () => {
  it('resolves @/ alias', () => {
    expect(typeof mulberry32(1)()).toBe('number');
  });
});
