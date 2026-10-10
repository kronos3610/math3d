import { test } from 'vitest';
import assert from 'node:assert';
import { calculateLoss } from './math.ts';

test('calculateLoss unit tests', () => {
  // Test origin (0, 0)
  // f(0, 0) = (0 + 0) * 0.12 + sin(0) * cos(0) * 0.3 = 0 + 0 * 1 * 0.3 = 0
  assert.strictEqual(calculateLoss(0, 0), 0);

  // Test some known point, e.g., (Math.PI/2, 0)
  // f(PI/2, 0) = ((PI/2)^2 + 0) * 0.12 + sin(PI/2) * cos(0) * 0.3
  // = (PI^2 / 4) * 0.12 + 1 * 1 * 0.3
  // = PI^2 * 0.03 + 0.3
  const expected = (Math.PI * Math.PI / 4) * 0.12 + Math.sin(Math.PI / 2) * Math.cos(0) * 0.3;
  assert.strictEqual(calculateLoss(Math.PI / 2, 0), expected);
});

test('calculateLoss property-based tests', () => {
  // Check properties over many random inputs
  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 20;
    const y = (Math.random() - 0.5) * 20;
    const result = calculateLoss(x, y);

    // Property: Result should be a number and not NaN
    assert.strictEqual(typeof result, 'number');
    assert.ok(!isNaN(result));

    // Property: Determinism
    assert.strictEqual(result, calculateLoss(x, y));

    // Property: Continuity (small change in input leads to small change in output)
    // The gradient is bounded, so it should be Lipschitz continuous locally
    const epsilon = 1e-10;
    const resultNear = calculateLoss(x + epsilon, y);
    assert.ok(Math.abs(result - resultNear) < 1e-7);
  }
});
