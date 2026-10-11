import { evaluatePolynomial, fitPolynomial, sampleNormal, seededRandom } from './regression';
import type { Sample } from './regression';

export const BIAS_VARIANCE_ENSEMBLE_SIZE = 48;
export const BIAS_VARIANCE_MAX_DEGREE = 9;

/** The regression function is the conditional mean E[Y | X = x]. */
export function biasVarianceSignal(x: number): number {
    return Math.sin(Math.PI * x) + 0.35 * x * x - 0.25;
}

export interface BiasVarianceOptions {
    degree: number;
    sampleSize: number;
    noiseStd: number;
    seed: number;
    ensembleSize?: number;
    testSize?: number;
    gridSize?: number;
    signal?: (x: number) => number;
}

export interface EnsembleDecomposition {
    meanPrediction: number[];
    predictionStd: number[];
    squaredBias: number;
    variance: number;
    noiseVariance: number;
    expectedTestMSE: number;
    ensembleSignalMSE: number;
}

export interface BiasVarianceExperiment extends EnsembleDecomposition {
    degree: number;
    sampleSize: number;
    ensembleSize: number;
    testSize: number;
    grid: number[];
    signalValues: number[];
    predictions: number[][];
    exampleSamples: Sample[];
    trainingMSE: number;
    testMSE: number;
}

function assertInteger(value: number, minimum: number, name: string): void {
    if (!Number.isInteger(value) || value < minimum) {
        throw new RangeError(`${name} must be an integer of at least ${minimum}.`);
    }
}

/**
 * Trapezoidal averages on a uniform x grid approximate the uniform input population.
 * Variance uses 1/M: these are exact moments of the empirical, finite fit ensemble,
 * rather than an unbiased estimate of the infinite training-set population variance.
 */
export function decomposePredictionEnsemble(
    signalValues: readonly number[],
    predictions: readonly (readonly number[])[],
    noiseStd: number,
): EnsembleDecomposition {
    if (signalValues.length < 2 || predictions.length < 1 ||
        !Number.isFinite(noiseStd) || noiseStd < 0 ||
        signalValues.some(value => !Number.isFinite(value)) ||
        predictions.some(fit => fit.length !== signalValues.length || fit.some(value => !Number.isFinite(value)))) {
        throw new RangeError('Provide finite predictions on the same uniform grid and nonnegative noise.');
    }

    const meanPrediction: number[] = [];
    const predictionStd: number[] = [];
    let squaredBias = 0;
    let variance = 0;
    let ensembleSignalMSE = 0;
    const gridIntervals = signalValues.length - 1;

    for (let index = 0; index < signalValues.length; index++) {
        const mean = predictions.reduce((sum, fit) => sum + fit[index], 0) / predictions.length;
        const pointVariance = predictions.reduce((sum, fit) => sum + (fit[index] - mean) ** 2, 0) / predictions.length;
        const pointSignalMSE = predictions.reduce((sum, fit) => sum + (fit[index] - signalValues[index]) ** 2, 0) / predictions.length;
        const weight = (index === 0 || index === gridIntervals ? 0.5 : 1) / gridIntervals;

        meanPrediction.push(mean);
        predictionStd.push(Math.sqrt(pointVariance));
        squaredBias += weight * (mean - signalValues[index]) ** 2;
        variance += weight * pointVariance;
        ensembleSignalMSE += weight * pointSignalMSE;
    }

    const noiseVariance = noiseStd ** 2;
    return {
        meanPrediction,
        predictionStd,
        squaredBias,
        variance,
        noiseVariance,
        expectedTestMSE: squaredBias + variance + noiseVariance,
        ensembleSignalMSE,
    };
}

/** Actual repeated polynomial fits; test observations are independent of training. */
export function runBiasVarianceExperiment(options: BiasVarianceOptions): BiasVarianceExperiment {
    const {
        degree,
        sampleSize,
        noiseStd,
        seed,
        ensembleSize = BIAS_VARIANCE_ENSEMBLE_SIZE,
        testSize = 128,
        gridSize = 121,
        signal = biasVarianceSignal,
    } = options;
    assertInteger(degree, 0, 'Degree');
    assertInteger(sampleSize, degree + 2, 'Sample size');
    assertInteger(ensembleSize, 2, 'Ensemble size');
    assertInteger(testSize, 1, 'Test size');
    assertInteger(gridSize, 2, 'Grid size');
    if (!Number.isFinite(noiseStd) || noiseStd < 0 || !Number.isFinite(seed)) {
        throw new RangeError('Noise must be finite and nonnegative; seed must be finite.');
    }

    const grid = Array.from({ length: gridSize }, (_, index) => -1 + 2 * index / (gridSize - 1));
    const signalValues = grid.map(signal);
    const predictions: number[][] = [];
    let exampleSamples: Sample[] = [];
    let trainingSquaredError = 0;
    let testSquaredError = 0;

    for (let trial = 0; trial < ensembleSize; trial++) {
        // Separate streams keep test observations independent and keep comparisons
        // across degree/noise on the same draws (common random numbers).
        const trainRandom = seededRandom(seed + trial * 104729);
        const testRandom = seededRandom(seed + trial * 104729 + 1000000007);
        const samples = Array.from({ length: sampleSize }, () => {
            const x = 2 * trainRandom() - 1;
            return { x, y: signal(x) + noiseStd * sampleNormal(trainRandom) };
        });
        const coefficients = fitPolynomial(samples, degree);
        predictions.push(grid.map(x => evaluatePolynomial(coefficients, x)));
        if (trial === 0) exampleSamples = samples;

        for (const sample of samples) {
            trainingSquaredError += (evaluatePolynomial(coefficients, sample.x) - sample.y) ** 2;
        }
        for (let index = 0; index < testSize; index++) {
            const x = 2 * testRandom() - 1;
            const y = signal(x) + noiseStd * sampleNormal(testRandom);
            testSquaredError += (evaluatePolynomial(coefficients, x) - y) ** 2;
        }
    }

    return {
        ...decomposePredictionEnsemble(signalValues, predictions, noiseStd),
        degree,
        sampleSize,
        ensembleSize,
        testSize,
        grid,
        signalValues,
        predictions,
        exampleSamples,
        trainingMSE: trainingSquaredError / (ensembleSize * sampleSize),
        testMSE: testSquaredError / (ensembleSize * testSize),
    };
}

export function runBiasVarianceSweep(options: Omit<BiasVarianceOptions, 'degree'>): BiasVarianceExperiment[] {
    return Array.from({ length: BIAS_VARIANCE_MAX_DEGREE }, (_, index) =>
        runBiasVarianceExperiment({ ...options, degree: index + 1 }));
}
