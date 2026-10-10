import { describe, expect, test } from 'vitest';
import { evaluatePolynomial } from './regression';
import { generateSignalSamples, predictionMse, runSignalNoiseExperiment, signalNoiseRatio, signalValue } from './signal-noise';
import type { SignalNoiseOptions } from './signal-noise';

const reference: SignalNoiseOptions = { amplitude: 1, noiseStd: 0.35, sampleSize: 60, degree: 5, seed: 3610 };

describe('signal-to-noise mathematics', () => {
    test('signal variance is centered over the uniform input domain', () => {
        const grid = Array.from({ length: 10000 }, (_, i) => signalValue(-1 + (i + 0.5) * 2 / 10000, 2));
        const mean = grid.reduce((sum, y) => sum + y, 0) / grid.length;
        const variance = grid.reduce((sum, y) => sum + (y - mean) ** 2, 0) / grid.length;
        const snr = signalNoiseRatio(2, 0.5);
        expect(mean).toBeCloseTo(0, 12);
        expect(variance).toBeCloseTo(snr.signalVariance, 12);
        expect(snr.signalVariance).toBe(2);
        expect(snr.noiseVariance).toBe(0.25);
        expect(snr.ratio).toBe(8);
        expect(snr.decibels).toBeCloseTo(10 * Math.log10(8), 12);
    });

    test('handles zero signal, zero noise, and their undefined joint limit', () => {
        expect(signalNoiseRatio(1, 0)).toMatchObject({ ratio: Infinity, decibels: Infinity });
        expect(signalNoiseRatio(0, 1)).toMatchObject({ ratio: 0, decibels: -Infinity });
        expect(signalNoiseRatio(0, 0)).toMatchObject({ ratio: null, decibels: null });
        const emptySignal = runSignalNoiseExperiment({ ...reference, amplitude: 0, noiseStd: 0 });
        expect(emptySignal.trainingMse).toBe(0);
        expect(emptySignal.testMse).toBe(0);
        expect(emptySignal.signalMse).toBe(0);
    });

    test('generated noise has the requested Gaussian mean and variance', () => {
        const samples = generateSignalSamples(30000, 1.7, 0.6, 2718);
        const noise = samples.map(sample => sample.y - signalValue(sample.x, 1.7));
        const mean = noise.reduce((sum, value) => sum + value, 0) / noise.length;
        const variance = noise.reduce((sum, value) => sum + (value - mean) ** 2, 0) / noise.length;
        expect(Math.abs(mean)).toBeLessThan(0.015);
        expect(Math.abs(variance - 0.36)).toBeLessThan(0.015);
        expect(samples.every(sample => sample.x >= -1 && sample.x <= 1)).toBe(true);
    });

    test('same seed reproduces samples and test observations use an independent stream', () => {
        const result = runSignalNoiseExperiment(reference);
        expect(runSignalNoiseExperiment(reference)).toEqual(result);
        expect(result.trainingSamples).not.toEqual(result.testSamples.slice(0, reference.sampleSize));
        expect(runSignalNoiseExperiment({ ...reference, sampleSize: 120, degree: 3 }).testSamples).toEqual(result.testSamples);
        expect(runSignalNoiseExperiment({ ...reference, seed: reference.seed + 1 }).trainingSamples).not.toEqual(result.trainingSamples);
    });

    test('doubling signal and noise preserves SNR while quadrupling squared errors', () => {
        const base = runSignalNoiseExperiment(reference);
        const doubled = runSignalNoiseExperiment({ ...reference, amplitude: 2, noiseStd: 0.7 });
        expect(doubled.snr.ratio).toBe(base.snr.ratio);
        expect(doubled.snr.decibels).toBe(base.snr.decibels);
        expect(doubled.trainingMse).toBeCloseTo(4 * base.trainingMse, 10);
        expect(doubled.testMse).toBeCloseTo(4 * base.testMse, 10);
        expect(doubled.signalMse).toBeCloseTo(4 * base.signalMse, 10);
    });

    test('train and test MSE measure the fitted predictions on their respective observations', () => {
        const result = runSignalNoiseExperiment(reference);
        const directTrainMse = result.trainingSamples.reduce((sum, sample) => {
            return sum + (sample.y - evaluatePolynomial(result.coefficients, sample.x)) ** 2;
        }, 0) / result.trainingSamples.length;
        expect(result.trainingMse).toBe(directTrainMse);
        expect(result.testMse).toBe(predictionMse(result.testSamples, result.coefficients));
        expect(result.testMse).not.toBe(result.trainingMse);
        expect(result.testMse).toBeCloseTo(result.signalMse + reference.noiseStd ** 2, 1);
    });

    test('model flexibility changes the fit while SNR remains a data property', () => {
        const linear = runSignalNoiseExperiment({ ...reference, noiseStd: 0.05, degree: 1 });
        const flexible = runSignalNoiseExperiment({ ...reference, noiseStd: 0.05, degree: 5 });
        expect(flexible.snr).toEqual(linear.snr);
        expect(flexible.trainingMse).toBeLessThan(linear.trainingMse);
        expect(flexible.signalMse).toBeLessThan(linear.signalMse);
    });

    test('rejects invalid noise, signal, and fit dimensions', () => {
        expect(() => signalNoiseRatio(1, -0.1)).toThrow(RangeError);
        expect(() => signalNoiseRatio(Infinity, 1)).toThrow(RangeError);
        expect(() => generateSignalSamples(0, 1, 1, 1)).toThrow(RangeError);
        expect(() => runSignalNoiseExperiment({ ...reference, degree: reference.sampleSize })).toThrow(RangeError);
        expect(() => predictionMse([], [0])).toThrow(RangeError);
    });
});
