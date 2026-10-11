import { expect, test } from 'vitest';
import assert from 'node:assert';
import { calculateRiemannBoxes, integrationFields, integrationTotals, LAYER_HEIGHT, FLOOR_GRID, partitionVolumeCells, midpointVolume } from './riemannUtils.ts';

test('calculateRiemannBoxes with simple constant function', () => {
    // Function f(x) = 1
    // Range [0, 4] with 4 partitions
    // dx should be 1
    // Boxes should be at x = 0.5, 1.5, 2.5, 3.5
    // Height should be 1
    const boxes = calculateRiemannBoxes(0, 4, 4, () => 1);

    assert.strictEqual(boxes.length, 4);

    boxes.forEach((box, i) => {
        // x position = start + i*dx + dx/2 = 0 + i*1 + 0.5
        assert.strictEqual(box.position[0], i + 0.5);
        // y position = h/2 = 1/2 = 0.5
        assert.strictEqual(box.position[1], 0.5);
        // z position = 0
        assert.strictEqual(box.position[2], 0);

        // x scale = dx * 0.9 = 0.9
        assert.strictEqual(box.scale[0], 0.9);
        // y scale = h = 1
        assert.strictEqual(box.scale[1], 1);
        // z scale = 0.5
        assert.strictEqual(box.scale[2], 0.5);
    });
});

test('calculateRiemannBoxes with linear function', () => {
    // Function f(x) = x
    // Range [0, 2] with 2 partitions
    // dx = 1
    // Box 1: x=0.5, h=0.5 -> pos=[0.5, 0.25, 0], scale=[0.9, 0.5, 0.5]
    // Box 2: x=1.5, h=1.5 -> pos=[1.5, 0.75, 0], scale=[0.9, 1.5, 0.5]
    const boxes = calculateRiemannBoxes(0, 2, 2, (x) => x);

    assert.strictEqual(boxes.length, 2);

    // First box
    assert.strictEqual(boxes[0].position[0], 0.5);
    assert.strictEqual(boxes[0].position[1], 0.25);
    assert.strictEqual(boxes[0].scale[1], 0.5);

    // Second box
    assert.strictEqual(boxes[1].position[0], 1.5);
    assert.strictEqual(boxes[1].position[1], 0.75);
    assert.strictEqual(boxes[1].scale[1], 1.5);
});

test('calculateRiemannBoxes with zero partitions', () => {
    const boxes = calculateRiemannBoxes(0, 4, 0, () => 1);
    assert.strictEqual(boxes.length, 0);
});

test('calculateRiemannBoxes with negative partitions', () => {
    const boxes = calculateRiemannBoxes(0, 4, -5, () => 1);
    assert.strictEqual(boxes.length, 0);
});

test('both smooth-function estimates approach a fine midpoint reference under refinement', () => {
    const f = integrationFields.smooth;
    const reference = midpointVolume(f, 400);
    const coarse = integrationTotals(f, 4, reference);
    const fine = integrationTotals(f, 32, reference);
    expect(Math.abs(fine.riemannError)).toBeLessThan(Math.abs(coarse.riemannError));
    expect(Math.abs(fine.lebesgueError)).toBeLessThan(Math.abs(coarse.lebesgueError));
    let gap = Infinity;
    for (const resolution of [4, 8, 16, 32, 64]) {
        const totals = integrationTotals(f, resolution, reference);
        expect(totals.lebesgue).toBeLessThanOrEqual(totals.sampledFloor + 1e-10);
        expect(totals.sampledFloor - totals.lebesgue).toBeLessThan(gap);
        gap = totals.sampledFloor - totals.lebesgue;
    }
});

test.each(['smooth', 'spiky'] as const)('%s estimates equal full mathematical volumes of the rendered cells', functionType => {
    const f = integrationFields[functionType]; const resolution = 12;
    const totals = integrationTotals(f, resolution);
    const columns = partitionVolumeCells('riemann', f, resolution);
    const columnVolume = columns.reduce((total, cell) => total + cell.scale[1] * (20 / resolution) ** 2, 0);
    expect(totals.riemann).toBeCloseTo(columnVolume, 10);
    const layers = partitionVolumeCells('lebesgue', f, resolution);
    expect(totals.lebesgue).toBeCloseTo(layers.length * (20 / FLOOR_GRID) ** 2 * LAYER_HEIGHT / resolution, 9);
    const minFloor = Math.min(...layers.map(cell => cell.position[0] - cell.scale[0] / 2));
    const maxFloor = Math.max(...layers.map(cell => cell.position[0] + cell.scale[0] / 2));
    expect(minFloor).toBeGreaterThanOrEqual(-10); expect(maxFloor).toBeLessThanOrEqual(10);
});

test('small positive midpoint heights are retained instead of silently discarded', () => {
    const cells = partitionVolumeCells('riemann', () => 0.05, 10);
    expect(cells).toHaveLength(100);
    expect(cells.every(cell => cell.scale[1] === 0.05)).toBe(true);
    expect(integrationTotals(() => 0.05, 10).riemann).toBeCloseTo(20, 10);
});
