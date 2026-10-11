import { describe, expect, test } from 'vitest';
import { BIAS_VARIANCE_MAX_DEGREE, decomposePredictionEnsemble, runBiasVarianceExperiment } from './bias-variance';

describe('bias–variance mathematics', () => {
    test('known predictions yield population ensemble variance and the exact decomposition', () => {
        const decomposition = decomposePredictionEnsemble([0, 1], [[0, 2], [2, 4]], 0.5);
        expect(decomposition.meanPrediction).toEqual([1, 3]);
        expect(decomposition.predictionStd).toEqual([1, 1]);
        expect(decomposition.squaredBias).toBe(2.5);
        expect(decomposition.variance).toBe(1);
        expect(decomposition.noiseVariance).toBe(0.25);
        expect(decomposition.ensembleSignalMSE).toBe(3.5);
        expect(decomposition.expectedTestMSE).toBe(3.75);
    });

    test('a noiseless correctly specified linear model has negligible bias, variance and prediction error', () => {
        const result = runBiasVarianceExperiment({
            degree: 1, sampleSize: 32, noiseStd: 0, seed: 31, signal: x => 2 - 3 * x,
        });
        // The scene's fixed 1e-6 ridge penalty introduces only tiny shrinkage.
        expect(result.squaredBias).toBeLessThan(1e-8);
        expect(result.variance).toBeLessThan(1e-8);
        expect(result.trainingMSE).toBeLessThan(1e-8);
        expect(result.testMSE).toBeLessThan(1e-8);
    });

    test('underfitting a quadratic signal with a constant estimator creates real squared bias', () => {
        const result = runBiasVarianceExperiment({
            degree: 0, sampleSize: 96, noiseStd: 0, seed: 802, signal: x => x * x,
        });
        // For uniform X in [-1,1], Var(X²) = 1/5 - (1/3)² = 4/45.
        expect(result.squaredBias).toBeCloseTo(4 / 45, 2);
        expect(result.variance).toBeGreaterThan(0);
        expect(result.ensembleSignalMSE).toBeCloseTo(result.squaredBias + result.variance, 12);
    });

    test('empirical decomposition is exact while independent noisy test MSE estimates the risk', () => {
        const result = runBiasVarianceExperiment({
            degree: 1, sampleSize: 80, noiseStd: 0.4, seed: 92,
            signal: x => 0.5 + 0.8 * x, testSize: 512, ensembleSize: 64,
        });
        expect(result.ensembleSignalMSE).toBeCloseTo(result.squaredBias + result.variance, 12);
        expect(result.noiseVariance).toBeCloseTo(0.16, 14);
        expect(result.testMSE).toBeCloseTo(result.expectedTestMSE, 2);
        expect(result.testMSE).toBeGreaterThan(result.trainingMSE);
    });

    test('more samples reduce prediction variance for a well-specified noisy linear model', () => {
        const base = { degree: 1, noiseStd: 0.5, seed: 238, ensembleSize: 64, signal: (x: number) => x };
        const small = runBiasVarianceExperiment({ ...base, sampleSize: 16 });
        const large = runBiasVarianceExperiment({ ...base, sampleSize: 128 });
        expect(large.variance).toBeLessThan(small.variance / 3);
    });

    test('seeded experiments are repeatable and degree comparisons share training samples', () => {
        const options = { degree: 2, sampleSize: 24, noiseStd: 0.3, seed: 19 };
        const first = runBiasVarianceExperiment(options);
        expect(runBiasVarianceExperiment(options)).toEqual(first);
        expect(runBiasVarianceExperiment({ ...options, degree: 3 }).exampleSamples).toEqual(first.exampleSamples);
    });

    test('the highest-complexity smallest-sample setting remains finite and decomposes correctly', () => {
        const result = runBiasVarianceExperiment({ degree: BIAS_VARIANCE_MAX_DEGREE, sampleSize: 16, noiseStd: 1, seed: 2718 });
        expect(result.predictions.every(fit => fit.every(Number.isFinite))).toBe(true);
        expect(Number.isFinite(result.testMSE)).toBe(true);
        expect(result.ensembleSignalMSE).toBeCloseTo(result.squaredBias + result.variance, 10);
    });

    test('rejects invalid inputs instead of producing misleading numerical metrics', () => {
        expect(() => decomposePredictionEnsemble([0, 1], [[0]], 0)).toThrow(RangeError);
        expect(() => decomposePredictionEnsemble([0, 1], [[0, 1]], -1)).toThrow(RangeError);
        expect(() => runBiasVarianceExperiment({ degree: 4, sampleSize: 4, noiseStd: 0.1, seed: 1 })).toThrow(RangeError);
    });
});
