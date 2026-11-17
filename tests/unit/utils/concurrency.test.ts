import { describe, expect, it } from 'vitest';
import { mapLimit } from '../../../src/utils/concurrency.js';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe('mapLimit', () => {
  it('returns an empty array for empty input', async () => {
    await expect(mapLimit([], 4, async () => 1)).resolves.toEqual([]);
  });

  it('preserves the input order', async () => {
    const results = await mapLimit([1, 2, 3, 4, 5], 2, async (value) => {
      await wait(10 - value);
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('never runs more tasks than the limit', async () => {
    let active = 0;
    let peak = 0;

    await mapLimit([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await wait(2);
      active -= 1;
      return null;
    });

    expect(peak).toBe(3);
  });

  it('does not exceed the number of items when the limit is larger', async () => {
    let active = 0;
    let peak = 0;

    await mapLimit([1, 2], 10, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await wait(2);
      active -= 1;
      return null;
    });

    expect(peak).toBe(2);
  });

  it('propagates failures', async () => {
    await expect(
      mapLimit([1, 2], 2, async (value) => {
        if (value === 2) {
          throw new Error('boom');
        }
        return value;
      }),
    ).rejects.toThrow('boom');
  });
});
