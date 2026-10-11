import { expect, test } from 'vitest';
import { boundaryAccuracy, boundaryNormal, boundaryPlanePolygon, boundaryPrediction, makeBoundaryDataset, type BoundaryParameters } from './decisionBoundaryMath';

const plane: BoundaryParameters = { kind: 'plane', tilt: 0, turn: 0, offset: 0, radius: 1.2 };
test('seeded labels stay fixed and reported errors equal an independent plane count', () => {
    for (const dataset of ['separable', 'overlap', 'xor', 'shells'] as const) {
        const points = makeBoundaryDataset(dataset, 31);
        expect(makeBoundaryDataset(dataset, 31)).toEqual(points);
        expect(makeBoundaryDataset(dataset, 32)).not.toEqual(points);
        const incorrect = points.map((p, index) => Number(p.position[0] >= 0) === p.classId ? -1 : index).filter(index => index >= 0);
        expect(boundaryAccuracy(points, plane).mistakes).toEqual(incorrect);
        expect(boundaryAccuracy(points, plane).accuracy).toBe(1 - incorrect.length / points.length);
    }
});
test('curved family solves shells, whereas a plane cannot solve alternating XOR labels', () => {
    const sphere: BoundaryParameters = { ...plane, kind: 'sphere' };
    expect(boundaryAccuracy(makeBoundaryDataset('shells'), sphere).accuracy).toBe(1);
    expect(boundaryAccuracy(makeBoundaryDataset('xor'), plane).accuracy).toBe(0.5);
    expect(boundaryAccuracy(makeBoundaryDataset('xor'), sphere).accuracy).toBe(0.5);
    expect(boundaryPrediction([1.2, 0, 0], sphere)).toBe(1);
    expect(boundaryPrediction([0, 0, 0], plane)).toBe(1);
});
test('clipped plane vertices stay on the actual plane and inside the feature cube', () => {
    for (const tilt of [-80, 0, 80]) for (const turn of [-180, -45, 0, 70]) for (const offset of [-2.5, 0, 2.5]) {
        const normal = boundaryNormal(tilt, turn), polygon = boundaryPlanePolygon(normal, offset);
        expect(polygon.length).toBeGreaterThanOrEqual(3);
        for (const point of polygon) {
            expect(point.every(value => Number.isFinite(value) && Math.abs(value) <= 3 + 1e-10)).toBe(true);
            expect(point.reduce((sum, value, axis) => sum + value * normal[axis], 0)).toBeCloseTo(offset, 10);
        }
    }
    expect(() => boundaryNormal(NaN, 0)).toThrow(RangeError);
    expect(() => boundaryPrediction([0, 0, 0], { ...plane, radius: -1 })).toThrow(RangeError);
});
