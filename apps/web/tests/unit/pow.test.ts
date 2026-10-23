import { describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { leadingZeroBits, sha256, solvePow } from '../../shared/pow';

describe('browser proof of work (G5)', () => {
  it('computes SHA-256 exactly like Node for every block-boundary length', () => {
    for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 200]) {
      const input = randomBytes(length);
      expect(Buffer.from(sha256(input)).toString('hex'), String(length)).toBe(
        createHash('sha256').update(input).digest('hex'),
      );
    }
  });
  it('finds a counter the Backend rule accepts', () => {
    const challenge = 'v1.LOGIN.' + 'a'.repeat(64) + '.1999999999.8.nonce.' + 'b'.repeat(64);
    const counter = solvePow(challenge, 8);
    const digest = createHash('sha256')
      .update(challenge + ':' + counter)
      .digest();
    expect(leadingZeroBits(digest)).toBeGreaterThanOrEqual(8);
  });
});
