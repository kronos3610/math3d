import { describe, expect, test } from 'vitest';
import { fitMLRegression, generateRegressionData, projectThreeObservations, regressionLoss, regressionPrediction } from './ml-regression';

describe('multifeature least squares', () => {
    test.each(['qr', 'svd', 'newton'] as const)('%s recovers a known noiseless plane', solver => {
        const samples = generateRegressionData({ noiseStd: 0 });
        const fit = fitMLRegression(samples, { solver });
        [0.3, 1.2, -0.8].forEach((coefficient, index) => expect(fit.coefficients[index]).toBeCloseTo(coefficient, 9));
        expect(fit.rank).toBe(3);
        expect(fit.gradientNorm).toBeLessThan(1e-9);
    });
    test('rank-deficient SVD returns the minimum-norm coefficient solution', () => {
        const samples = generateRegressionData({ preset: 'collinear', noiseStd: 0 });
        const fit = fitMLRegression(samples, { solver: 'svd' });
        expect(fit.rank).toBe(2);
        expect(fit.conditionNumber).toBe(Infinity);
        expect(fit.coefficients[0]).toBeCloseTo(0.3, 10);
        expect(fit.coefficients[1]).toBeCloseTo(0.2, 10);
        expect(fit.coefficients[2]).toBeCloseTo(0.2, 10);
        expect(fitMLRegression(samples, { solver: 'qr' }).method).toContain('fallback');
        for (const sample of samples) expect(regressionPrediction(fit.coefficients, sample.x1, sample.x2)).toBeCloseTo(sample.y, 10);
    });
    test('underdetermined SVD predicts the observations with minimum norm', () => {
        const samples = [{ x1: 0, x2: 0, y: 1 }, { x1: 1, x2: 0, y: 3 }];
        const fit = fitMLRegression(samples, { solver: 'svd' });
        expect(fit.coefficients[0]).toBeCloseTo(1, 10);
        expect(fit.coefficients[1]).toBeCloseTo(2, 10);
        expect(fit.coefficients[2]).toBeCloseTo(0, 10);
    });
    test('quadratic basis recovers the actual curved generating function', () => {
        const samples = generateRegressionData({ preset: 'curved', noiseStd: 0 });
        const fit = fitMLRegression(samples, { basis: 'quadratic', solver: 'svd' });
        [0.3, 1.2, -0.8, 1.2, -0.7, 0].forEach((value, index) => expect(fit.coefficients[index]).toBeCloseTo(value, 8));
        expect(regressionLoss(samples, fit.coefficients, 'quadratic')).toBeLessThan(1e-14);
        expect(regressionLoss(samples, fitMLRegression(samples).coefficients)).toBeGreaterThan(0.01);
    });
    test('weights and ridge optimize their stated objective and keep the intercept unpenalized', () => {
        const samples = generateRegressionData().map((sample, index) => ({ ...sample, weight: index % 2 ? 10 : 1 }));
        const qr = fitMLRegression(samples, { ridge: 0.7 });
        const svd = fitMLRegression(samples, { ridge: 0.7, solver: 'svd' });
        qr.coefficients.forEach((value, index) => expect(value).toBeCloseTo(svd.coefficients[index], 9));
        expect(qr.gradientNorm).toBeLessThan(1e-9);
        expect(regressionLoss(samples, qr.coefficients, 'linear', 0.7)).toBeLessThan(regressionLoss(samples, [0.3, 1.2, -0.8], 'linear', 0.7));
    });
    test('true GD steps lower the quadratic objective and converge to the direct solution', () => {
        const samples = generateRegressionData({ noiseStd: 0 });
        const fit = fitMLRegression(samples, { solver: 'gd', iterations: 180, learningRate: 0.8 });
        for (let index = 1; index < fit.trace.length; index++) expect(fit.trace[index].loss).toBeLessThanOrEqual(fit.trace[index - 1].loss + 1e-12);
        expect(fit.gradientNorm).toBeLessThan(1e-6);
        expect(fit.coefficients[1]).toBeCloseTo(1.2, 5);
    });
    test('stochastic updates are deterministic and approach the same noiseless optimum', () => {
        const samples = generateRegressionData({ noiseStd: 0 });
        const options = { solver: 'sgd' as const, iterations: 2500, learningRate: 0.2, seed: 9 };
        const first = fitMLRegression(samples, options);
        expect(first.trace).toEqual(fitMLRegression(samples, options).trace);
        expect(first.coefficients[1]).toBeCloseTo(1.2, 3);
        expect(first.coefficients[2]).toBeCloseTo(-0.8, 3);
    });
    test('non-Gaussian errors have the stated bounded uniform scale and do not change the noiseless mean', () => {
        const samples = generateRegressionData({ preset: 'non-gaussian', sampleSize: 500, noiseStd: 0.3 });
        const errors = samples.map(sample => sample.y - (0.3 + 1.2 * sample.x1 - 0.8 * sample.x2));
        expect(errors.every(error => Math.abs(error) <= Math.sqrt(3) * 0.3 + 1e-12)).toBe(true);
        expect(Math.abs(errors.reduce((sum, error) => sum + error, 0) / errors.length)).toBeLessThan(0.04);
        const exact = fitMLRegression(generateRegressionData({ preset: 'non-gaussian', noiseStd: 0 }));
        [0.3, 1.2, -0.8].forEach((coefficient, index) => expect(exact.coefficients[index]).toBeCloseTo(coefficient, 9));
    });
    test('correlated errors begin at their stationary variance and have the declared lag dependence', () => {
        const pairs = Array.from({ length: 1500 }, (_, seed) => {
            const samples = generateRegressionData({ preset: 'correlated-errors', sampleSize: 3, noiseStd: 0.2, seed });
            return samples.slice(0, 2).map(sample => sample.y - (0.3 + 1.2 * sample.x1 - 0.8 * sample.x2));
        });
        const firstVariance = pairs.reduce((sum, pair) => sum + pair[0] ** 2, 0) / pairs.length;
        const secondVariance = pairs.reduce((sum, pair) => sum + pair[1] ** 2, 0) / pairs.length;
        const lagCovariance = pairs.reduce((sum, pair) => sum + pair[0] * pair[1], 0) / pairs.length;
        expect(firstVariance).toBeCloseTo(0.04, 2);
        expect(secondVariance).toBeCloseTo(0.04, 2);
        expect(lagCovariance).toBeCloseTo(0.85 * 0.04, 2);
    });
    test('a full-size mini batch equals full GD, while smaller seeded batches genuinely converge', () => {
        const samples = generateRegressionData({ noiseStd: 0 });
        const options = { learningRate: 0.7, iterations: 160, ridge: 0.2 };
        const full = fitMLRegression(samples, { ...options, solver: 'gd' });
        const batch = fitMLRegression(samples, { ...options, solver: 'minibatch', batchSize: samples.length });
        batch.coefficients.forEach((value, index) => expect(value).toBeCloseTo(full.coefficients[index], 10));
        batch.trace.forEach((frame, index) => expect(frame.loss).toBeCloseTo(full.trace[index].loss, 10));
        const small = { solver: 'minibatch' as const, batchSize: 6, learningRate: 0.5, iterations: 600, seed: 4 };
        const stochastic = fitMLRegression(samples, small);
        expect(stochastic.trace).toEqual(fitMLRegression(samples, small).trace);
        expect(stochastic.trace).not.toEqual(full.trace);
        expect(stochastic.coefficients[1]).toBeCloseTo(1.2, 3);
        expect(stochastic.coefficients[2]).toBeCloseTo(-0.8, 3);
    });
    test('three-observation projection has the known answer and a residual orthogonal to both columns', () => {
        const projected = projectThreeObservations([-1, 0, 1], [1, 0, 3]);
        expect(projected.rank).toBe(2);
        expect(projected.coefficients[0]).toBeCloseTo(4 / 3, 10);
        expect(projected.coefficients[1]).toBeCloseTo(1, 10);
        [1 / 3, 4 / 3, 7 / 3].forEach((value, index) => expect(projected.fitted[index]).toBeCloseTo(value, 10));
        expect(projected.errorNorm ** 2).toBeCloseTo(8 / 3, 10);
        expect(projected.residualInterceptDot).toBeCloseTo(0, 10);
        expect(projected.residualFeatureDot).toBeCloseTo(0, 10);
        expect(projected.response.reduce((sum, value) => sum + value * value, 0)).toBeCloseTo(projected.fitted.reduce((sum, value) => sum + value * value, 0) + projected.errorNorm ** 2, 10);
    });
    test('constant-feature projection remains the exact mean projection with minimum-norm coefficients', () => {
        const projected = projectThreeObservations([2, 2, 2], [1, 2, 6]);
        expect(projected.rank).toBe(1);
        projected.fitted.forEach(value => expect(value).toBeCloseTo(3, 10));
        expect(projected.coefficients[0]).toBeCloseTo(0.6, 10);
        expect(projected.coefficients[1]).toBeCloseTo(1.2, 10);
        expect(projected.residualInterceptDot).toBeCloseTo(0, 10);
    });
});
