import { expect, test } from 'vitest';
import { seededRandom } from '../../utils/regression';
import { multiplyMatrixVector, SUBSPACE_MATRIX } from './legacyLinearMath';
import { decomposeSubspaceInput } from './subspaceLiteMath';

test('the starting example and pure null/row directions have the expected decomposition', () => {
    expect(decomposeSubspaceInput([3, 3, 3]).rowPart).toEqual([1, 4, 2]);
    expect(decomposeSubspaceInput([3, 3, 3]).nullPart).toEqual([2, -1, 1]);
    expect(decomposeSubspaceInput([2, -1, 1]).rowPart).toEqual([0, 0, 0]);
    expect(decomposeSubspaceInput([1, 2, 0]).nullPart.every(value => value === 0)).toBe(true);
    expect(decomposeSubspaceInput([0, 0, 0]).output).toEqual([0, 0, 0]);
});
test('arbitrary inputs reconstruct, are perpendicular, and have the same image as their row component', () => {
    const random = seededRandom(45);
    for (let index = 0; index < 200; index++) {
        const input: [number, number, number] = [10 * random() - 5, 10 * random() - 5, 10 * random() - 5];
        const d = decomposeSubspaceInput(input), rowOutput = multiplyMatrixVector(SUBSPACE_MATRIX, d.rowPart);
        expect(d.reconstructionError).toBeLessThan(1e-12);
        expect(Math.abs(d.dot)).toBeLessThan(1e-12);
        d.nullOutput.forEach(value => expect(Math.abs(value)).toBeLessThan(1e-12));
        rowOutput.forEach((value, axis) => expect(value).toBeCloseTo(d.output[axis], 10));
    }
    expect(() => decomposeSubspaceInput([NaN, 1, 2])).toThrow(RangeError);
});
