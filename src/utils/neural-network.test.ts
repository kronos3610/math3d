import { describe, test } from 'vitest';
import assert from 'node:assert';
import { getNeuronPositions } from './neural-network.ts';

describe('getNeuronPositions unit tests', () => {
    test('returns correct positions for a single neuron', () => {
        // With count=1, offset = ((1-1)*1.2)/2 = 0
        // Position: [x, 0*1.2 - 0, 0] = [x, 0, 0]
        const positions = getNeuronPositions(1, 5);
        assert.deepStrictEqual(positions, [[5, 0, 0]]);
    });

    test('returns correct positions for two neurons', () => {
        // With count=2, spacing=1.2, offset = ((2-1)*1.2)/2 = 0.6
        // i=0: [5, 0*1.2 - 0.6, 0] = [5, -0.6, 0]
        // i=1: [5, 1*1.2 - 0.6, 0] = [5, 0.6, 0]
        const positions = getNeuronPositions(2, 5);
        assert.strictEqual(positions.length, 2);
        // Using approximate equality for floating point numbers isn't strictly necessary here since the math is simple,
        // but exact check is safer for strict requirements.
        assert.deepStrictEqual(positions[0], [5, -0.6, 0]);
        assert.deepStrictEqual(positions[1], [5, 0.6, 0]);
    });

    test('returns correct positions for three neurons', () => {
        // With count=3, spacing=1.2, offset = ((3-1)*1.2)/2 = 1.2
        // i=0: [0, 0 - 1.2, 0] = [0, -1.2, 0]
        // i=1: [0, 1.2 - 1.2, 0] = [0, 0, 0]
        // i=2: [0, 2.4 - 1.2, 0] = [0, 1.2, 0]
        const positions = getNeuronPositions(3, 0);
        assert.strictEqual(positions.length, 3);
        assert.deepStrictEqual(positions[0], [0, -1.2, 0]);
        assert.deepStrictEqual(positions[1], [0, 0, 0]);
        assert.deepStrictEqual(positions[2], [0, 1.2, 0]);
    });

    test('handles custom spacing', () => {
        // With count=2, spacing=2.0, offset = ((2-1)*2.0)/2 = 1.0
        // i=0: [10, -1.0, 0]
        // i=1: [10, 1.0, 0]
        const positions = getNeuronPositions(2, 10, 2.0);
        assert.deepStrictEqual(positions[0], [10, -1.0, 0]);
        assert.deepStrictEqual(positions[1], [10, 1.0, 0]);
    });

    test('returns empty array for count <= 0', () => {
        assert.deepStrictEqual(getNeuronPositions(0, 5), []);
        assert.deepStrictEqual(getNeuronPositions(-5, 5), []);
    });

    test('handles large counts correctly', () => {
        const count = 100;
        const positions = getNeuronPositions(count, 0);
        assert.strictEqual(positions.length, count);
        // Verify center is approximately 0
        const sumY = positions.reduce((sum, pos) => sum + pos[1], 0);
        assert.ok(Math.abs(sumY) < 1e-10, 'Sum of Y positions should be centered around 0');
    });
});
