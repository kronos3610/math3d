import { expect, test } from 'vitest';
import { QUADRATIC_CENTER, QUADRATIC_CURVATURE, quadraticWeightLoss, radialNormShrink, solveBudgetQuadratic, weightNorm, type BudgetNorm } from './regularizationModel';

test('isotropic objectives agree with independent L2 radial and L1 soft-threshold solutions', () => {
    const ridge = solveBudgetQuadratic('ridge', 2.5, [4, -2, 1], [1, 1, 1]);
    [4, -2, 1].forEach((value, index) => expect(ridge[index]).toBeCloseTo(value * 2.5 / Math.sqrt(21), 12));
    const lasso = solveBudgetQuadratic('lasso', 3, [4, -2, 1], [1, 1, 1]);
    [2.5, -0.5, 0].forEach((value, index) => expect(lasso[index]).toBeCloseTo(value, 12));
});

test.each(['ridge', 'lasso'] as const)('%s solution is feasible and satisfies the convex optimality conditions', norm => {
    for (const budget of [0.1, 1.5, 4, 8]) {
        const result = solveBudgetQuadratic(norm, budget);
        expect(weightNorm(result, norm)).toBeLessThanOrEqual(budget + 1e-12);
        if (weightNorm(QUADRATIC_CENTER, norm) <= budget) {
            expect(result).toEqual(QUADRATIC_CENTER);
            expect(quadraticWeightLoss(result)).toBe(0);
            continue;
        }
        expect(weightNorm(result, norm)).toBeCloseTo(budget, 12);
        const gradient = result.map((value, index) => QUADRATIC_CURVATURE[index] * (value - QUADRATIC_CENTER[index]));
        const active = result.findIndex(value => value !== 0);
        const multiplier = -gradient[active] / (norm === 'ridge' ? result[active] : Math.sign(result[active]));
        result.forEach((value, index) => {
            if (value === 0) expect(Math.abs(gradient[index])).toBeLessThanOrEqual(multiplier + 1e-12);
            else expect(gradient[index] + multiplier * (norm === 'ridge' ? value : Math.sign(value))).toBeCloseTo(0, 11);
        });
    }
});

test('anisotropic L2 minimum improves on radial rescaling, and L1 creates actual zero coordinates', () => {
    const minimum = solveBudgetQuadratic('ridge', 1.5);
    expect(quadraticWeightLoss(minimum)).toBeLessThan(quadraticWeightLoss(radialNormShrink(QUADRATIC_CENTER, 2, 1.5)));
    expect(solveBudgetQuadratic('lasso', 1.5)[0]).toBe(0);
    expect(solveBudgetQuadratic('lasso', 0.1).filter(value => value === 0)).toHaveLength(2);
});

test('radial norm illustration preserves direction and uses exact L-infinity at corners', () => {
    expect(radialNormShrink([2, -2, 2], Infinity, 1)).toEqual([1, -1, 1]);
    expect(radialNormShrink([0, 0, 0], 1, 0)).toEqual([0, 0, 0]);
    expect(radialNormShrink([0.2, -0.3, 0.1], 2, 1)).toEqual([0.2, -0.3, 0.1]);
    expect(radialNormShrink([3, -2, 1], 1, 2)).toEqual([1, -2 / 3, 1 / 3]);
});

test.each(['ridge', 'lasso'] as BudgetNorm[])('%s rejects invalid problem definitions', norm => {
    expect(() => solveBudgetQuadratic(norm, -1)).toThrow();
    expect(() => solveBudgetQuadratic(norm, 1, [1, 2, 3], [1, 0, 1])).toThrow();
    expect(solveBudgetQuadratic(norm, 0)).toEqual([0, 0, 0]);
});
