import { evaluatePolynomial, fitPolynomial, sampleNormal, seededRandom } from './regression';
import type { Sample } from './regression';

export interface SignalNoiseOptions {
    amplitude: number;
    noiseStd: number;
    sampleSize: number;
    degree: number;
    seed: number;
}

export interface SignalNoiseRatio {
    signalVariance: number;
    noiseVariance: number;
    /** null denotes the undefined ratio 0 / 0. */
    ratio: number | null;
    decibels: number | null;
}

export interface SignalNoiseExperiment {
    trainingSamples: Sample[];
    testSamples: Sample[];
    coefficients: number[];
    trainingMse: number;
    testMse: number;
    /** Midpoint quadrature estimate of E_x[(fit(x) - signal(x))²]. */
    signalMse: number;
    snr: SignalNoiseRatio;
}

/** x is uniform on [-1, 1], so this signal has mean zero and variance A² / 2. */
export function signalValue(x: number, amplitude: number): number {
    return amplitude * Math.sin(Math.PI * x);
}

export function signalNoiseRatio(amplitude: number, noiseStd: number): SignalNoiseRatio {
    if (!Number.isFinite(amplitude) || amplitude < 0 || !Number.isFinite(noiseStd) || noiseStd < 0) {
        throw new RangeError('Signal amplitude and noise standard deviation must be finite and nonnegative.');
    }
    const signalVariance = amplitude ** 2 / 2;
    const noiseVariance = noiseStd ** 2;
    const ratio = signalVariance === 0 && noiseVariance === 0
        ? null
        : signalVariance / noiseVariance;
    return {
        signalVariance,
        noiseVariance,
        ratio,
        decibels: ratio === null ? null : 10 * Math.log10(ratio),
    };
}

export function generateSignalSamples(
    sampleSize: number,
    amplitude: number,
    noiseStd: number,
    seed: number,
): Sample[] {
    signalNoiseRatio(amplitude, noiseStd);
    if (!Number.isSafeInteger(sampleSize) || sampleSize < 1) {
        throw new RangeError('Sample size must be a positive integer.');
    }
    const random = seededRandom(seed);
    return Array.from({ length: sampleSize }, () => {
        const x = random() * 2 - 1;
        // Always draw standardized noise so changing A or sigma preserves sample locations.
        const noise = sampleNormal(random);
        return { x, y: signalValue(x, amplitude) + noiseStd * noise };
    });
}

export function predictionMse(samples: readonly Sample[], coefficients: readonly number[]): number {
    if (samples.length === 0) throw new RangeError('MSE requires at least one sample.');
    return samples.reduce((sum, sample) => {
        const residual = evaluatePolynomial(coefficients, sample.x) - sample.y;
        return sum + residual ** 2;
    }, 0) / samples.length;
}

export function runSignalNoiseExperiment(options: SignalNoiseOptions): SignalNoiseExperiment {
    const { amplitude, noiseStd, sampleSize, degree, seed } = options;
    const snr = signalNoiseRatio(amplitude, noiseStd);
    if (!Number.isSafeInteger(degree) || degree < 0 || degree >= sampleSize) {
        throw new RangeError('Polynomial degree must be nonnegative and smaller than the sample size.');
    }
    const trainingSamples = generateSignalSamples(sampleSize, amplitude, noiseStd, seed);
    // A separate deterministic random stream keeps test data independent of fitting and sample size.
    const testSamples = generateSignalSamples(2000, amplitude, noiseStd, (seed + 0x9e3779b9) >>> 0);
    const coefficients = fitPolynomial(trainingSamples, degree);
    const gridSize = 2000;
    let signalError = 0;
    for (let i = 0; i < gridSize; i++) {
        const x = -1 + (i + 0.5) * 2 / gridSize;
        signalError += (evaluatePolynomial(coefficients, x) - signalValue(x, amplitude)) ** 2;
    }
    return {
        trainingSamples,
        testSamples,
        coefficients,
        trainingMse: predictionMse(trainingSamples, coefficients),
        testMse: predictionMse(testSamples, coefficients),
        signalMse: signalError / gridSize,
        snr,
    };
}
