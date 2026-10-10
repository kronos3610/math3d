import { expect, test } from 'vitest';
import { diagonalMixtureEStep, diagonalMixtureMStep, type MixtureParameters, type MixturePoint } from './legacyMixtureMath';

const previous: MixtureParameters = { means: [[-2, 0, 0], [2, 0, 0]], variances: [[1, 1, 1], [1, 1, 1]], weights: [0.5, 0.5] };
test('log-space responsibilities include extreme observations instead of dropping underflowed densities', () => {
    const result = diagonalMixtureEStep([[1000, 0, 0], [0, 0, 0]], previous);
    expect(Number.isFinite(result.logLikelihood)).toBe(true); expect(result.logLikelihood).toBeLessThan(-490000);
    expect(result.responsibilities[0]).toEqual([0, 1]);
    expect(result.responsibilities[1]).toEqual([0.5, 0.5]);
    result.responsibilities.forEach(row => expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12));
});

test('M-step matches weighted moments, applies the variance constraint, and removes dead-component weight', () => {
    const next = diagonalMixtureMStep([[0, 2, 4], [2, 4, 6]], [[1, 0], [1, 0]], previous);
    expect(next.means[0]).toEqual([1, 3, 5]); expect(next.variances[0]).toEqual([1, 1, 1]); expect(next.weights).toEqual([1, 0]);
    expect(next.means[1]).toEqual(previous.means[1]);
    const one = diagonalMixtureMStep([[0, 0, 0]], [[1, 0]], previous);
    expect(one.variances[0]).toEqual([0.5, 0.5, 0.5]);
});

test('actual E/M rounds keep weights normalized and do not decrease constrained log-likelihood', () => {
    const points: MixturePoint[] = [[-3, -1, 0], [-2, 1, 1], [-1, 0, -1], [1, -1, 1], [2, 1, 0], [3, 0, -1]];
    let model = previous; let score = diagonalMixtureEStep(points, model).logLikelihood;
    for (let step = 0; step < 8; step++) {
        const e = diagonalMixtureEStep(points, model); model = diagonalMixtureMStep(points, e.responsibilities, model);
        const next = diagonalMixtureEStep(points, model).logLikelihood;
        expect(model.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        expect(next).toBeGreaterThanOrEqual(score - 1e-10); score = next;
    }
});
