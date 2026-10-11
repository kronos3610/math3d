import { expect, test } from 'vitest';
import { assessEigenvector, eigenAlignment, fibonacciSphere, matrixDeterminant, multiplyMatrixVector, SUBSPACE_EXAMPLE, SUBSPACE_MATRIX, transformationMatrix } from './legacyLinearMath';

test('the displayed subspace decomposition has its claimed orthogonality, null image, and column coordinates', () => {
    const { x, x_row: row, x_null: nullVector, b, c1, c2, colNormal } = SUBSPACE_EXAMPLE;
    expect(row.map((value, i) => value + nullVector[i])).toEqual(x);
    expect(row.reduce((sum, value, i) => sum + value * nullVector[i], 0)).toBe(0);
    expect(multiplyMatrixVector(SUBSPACE_MATRIX, nullVector)).toEqual([0, 0, 0]);
    expect(multiplyMatrixVector(SUBSPACE_MATRIX, row)).toEqual(b);
    expect(c1.map((value, i) => -3 * value + 6 * c2[i])).toEqual(b);
    expect([c1, c2, b].every(v => v.reduce((sum, value, i) => sum + value * colNormal[i], 0) === 0)).toBe(true);
    expect(matrixDeterminant(SUBSPACE_MATRIX)).toBe(0);
});

test('matrix composition applies scaling, shear, rotation in the stated order', () => {
    const matrix = transformationMatrix([2, 3, -4], Math.PI / 2, 0.5);
    const result = multiplyMatrixVector(matrix, [1, 2, 3]);
    // Scale: (2,6,-12), shear: (5,6,-12), rotate: (-6,5,-12).
    [-6, 5, -12].forEach((value, i) => expect(result[i]).toBeCloseTo(value, 12));
    expect(matrixDeterminant(matrix)).toBeCloseTo(-24, 12);
    expect(matrixDeterminant(transformationMatrix([1, 1, 0], 0.7, 1))).toBe(0);
});

test('relative eigenvector criterion rejects tiny nonparallel images and accepts negative or zero eigenvalues', () => {
    expect(assessEigenvector([1, 0, 0], [1e-12, 1e-12, 0]).isEigen).toBe(false);
    expect(assessEigenvector([2, -1, 0], [-6, 3, 0])).toEqual({ isEigen: true, lambda: -3, residual: 0 });
    expect(assessEigenvector([2, -1, 0], [0, 0, 0])).toEqual({ isEigen: true, lambda: 0, residual: 0 });
    expect(assessEigenvector([0, 0, 0], [0, 0, 0]).isEigen).toBe(false);
    expect(assessEigenvector([0, 0, 0], [0, 0, 0]).lambda).toBeNull();
});


test('alignment map measures eigen-lines, including negative and zero images, without confusing singular axes', () => {
    const diagonal = [2, 0, 0, 0, 1.5, 0, 0, 0, -0.5] as const;
    expect(eigenAlignment([...diagonal], [1, 0, 0])).toBe(1);
    expect(eigenAlignment([...diagonal], [0, 0, -1])).toBe(1);
    expect(eigenAlignment([...diagonal], [1, 1, 1])).toBeLessThan(1);
    expect(eigenAlignment([0, 0, 0, 0, 1, 0, 0, 0, 1], [1, 0, 0])).toBe(1);
    const shear = [1, 1, 0, 0, 1, 0, 0, 0, 1] as const;
    expect(eigenAlignment([...shear], [1, 0, 2])).toBe(1);
    expect(eigenAlignment([...shear], [0, 1, 0])).toBeLessThan(1);
    const rotation = [0, -1, 0, 1, 0, 0, 0, 0, 1] as const;
    expect(eigenAlignment([...rotation], [0, 0, 1])).toBe(1);
    expect(eigenAlignment([...rotation], [1, 0, 0])).toBe(0);
});

test('Fibonacci map is reproducible and all sampled directions have unit length', () => {
    const samples = fibonacciSphere(300);
    expect(samples).toHaveLength(300);
    expect(samples).toEqual(fibonacciSphere(300));
    samples.forEach(sample => expect(Math.hypot(...sample)).toBeCloseTo(1, 12));
});
