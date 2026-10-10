import { describe, expect, test } from 'vitest';
import { finiteSVMLift, fitSVM, fitSVR, svmPrediction } from './ml-svm';
import type { SVMObservation, SVRObservation } from './ml-svm';

describe('support vector optimization', () => {
    const separable: SVMObservation[] = [
        { x: [-2, -1, 0], label: -1 }, { x: [-1, 0, 0], label: -1 },
        { x: [1, 0, 0], label: 1 }, { x: [2, 1, 0], label: 1 },
    ];
    test('dual fitting finds the true separating maximum-margin solution and KKT conditions', () => {
        const fit = fitSVM(separable, { C: 10, tolerance: 1e-6 });
        expect(fit.converged).toBe(true);
        expect(fit.featureWeights?.[0]).toBeCloseTo(1, 5);
        expect(fit.featureWeights?.[1]).toBeCloseTo(0, 5);
        expect(fit.bias).toBeCloseTo(0, 5);
        expect(fit.coefficients.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 10);
        expect(fit.primalObjective - fit.dualObjective).toBeLessThan(1e-5);
        for (const sample of separable) expect(sample.label * svmPrediction(fit, sample.x)).toBeGreaterThanOrEqual(1 - 1e-5);
    });
    test('soft margins remain feasible for contradictory labels and explicitly report convergence', () => {
        const samples = [...separable, { x: [1, 0, 0] as [number, number, number], label: -1 as const }];
        const fit = fitSVM(samples, { C: 0.4, tolerance: 1e-5 });
        expect(fit.alphas.every(value => value >= 0 && value <= 0.4 + 1e-10)).toBe(true);
        expect(fit.kktResidual).toBeLessThan(1e-4);
        expect(fit.primalObjective - fit.dualObjective).toBeLessThan(1e-4);
        for (let index = 1; index < fit.trace.length; index++) expect(fit.trace[index].dualObjective).toBeGreaterThanOrEqual(fit.trace[index - 1].dualObjective - 1e-10);
    });
    test('the exact finite lift and RBF kernel solve a nonlinear concentric example', () => {
        const rings: SVMObservation[] = [];
        for (const radius of [0.3, 1]) for (let index = 0; index < 10; index++) {
            const angle = index * 2 * Math.PI / 10;
            rings.push({ x: [radius * Math.cos(angle), radius * Math.sin(angle), 0], label: radius < 0.5 ? -1 : 1 });
        }
        expect(finiteSVMLift([3, 4, 0])).toEqual([3, 4, 25]);
        for (const kernel of ['lift', 'rbf'] as const) {
            const fit = fitSVM(rings, { kernel, C: 10, gamma: 2, tolerance: 0.001 });
            expect(fit.converged).toBe(true);
            expect(rings.every(sample => sample.label * svmPrediction(fit, sample.x) > 0)).toBe(true);
            expect(fit.primalObjective - fit.dualObjective).toBeLessThan(0.1);
        }
    });
    test('training-only scaling applies identically to prediction', () => {
        const fit = fitSVM(separable.map(sample => ({ ...sample, x: [sample.x[0] * 100, sample.x[1], 0] as [number, number, number] })), { scale: true, C: 10 });
        expect(svmPrediction(fit, [100, 0, 0])).toBeGreaterThan(0);
        expect(svmPrediction(fit, [-100, 0, 0])).toBeLessThan(0);
    });
    test('epsilon-SVR solves the genuine insensitive-loss dual with a small primal-dual gap', () => {
        const samples: SVRObservation[] = [-1, -0.7, -0.3, 0, 0.3, 0.7, 1].map(x => ({ x: [x, 0, 0], y: 0.4 + 1.2 * x }));
        const fit = fitSVR(samples, { epsilon: 0.1, C: 20, tolerance: 1e-5 });
        expect(fit.converged).toBe(true);
        expect(fit.coefficients.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 10);
        expect(fit.primalObjective - fit.dualObjective).toBeLessThan(1e-4);
        for (const sample of samples) expect(Math.abs(sample.y - svmPrediction(fit, sample.x))).toBeLessThanOrEqual(0.1001);
        expect(fit.supportIndices.length).toBeLessThan(samples.length);
    });
    test('wide SVR epsilon can ignore all observations without inventing support vectors', () => {
        const fit = fitSVR([{ x: [-1, 0, 0], y: 0.2 }, { x: [1, 0, 0], y: 0.4 }], { epsilon: 1 });
        expect(fit.supportIndices).toHaveLength(0);
        expect(fit.converged).toBe(true);
    });
});
