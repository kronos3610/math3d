export type LossKind = 'squared' | 'absolute' | 'huber' | 'bce';
export interface LossMeasurement { loss: number; slope: number | null; curvature: number | null; probability?: number; }
const sigmoid = (value: number) => value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));

/** BCE takes a logit, not a probability; fractional targets are valid soft labels. */
export function measureLoss(kind: LossKind, prediction: number, target: number, delta = 1): LossMeasurement {
    if (!Number.isFinite(prediction) || !Number.isFinite(target)) throw new Error('Prediction and target must be finite.');
    const residual = prediction - target;
    if (kind === 'bce') {
        if (target < 0 || target > 1) throw new Error('A Bernoulli target must be in [0, 1].');
        const probability = sigmoid(prediction);
        return { loss: Math.max(prediction, 0) - prediction * target + Math.log1p(Math.exp(-Math.abs(prediction))), slope: probability - target, curvature: probability * (1 - probability), probability };
    }
    if (kind === 'absolute') return { loss: Math.abs(residual), slope: residual === 0 ? null : Math.sign(residual), curvature: residual === 0 ? null : 0 };
    if (kind === 'huber') {
        if (!(delta > 0)) throw new Error('Huber delta must be positive.');
        const magnitude = Math.abs(residual);
        return { loss: magnitude <= delta ? residual * residual / 2 : delta * (magnitude - delta / 2),
            slope: magnitude <= delta ? residual : delta * Math.sign(residual), curvature: magnitude === delta ? null : magnitude < delta ? 1 : 0 };
    }
    return { loss: residual * residual / 2, slope: residual, curvature: 1 };
}

export interface RegressionPoint { input: number; target: number; truth: number; }
export interface RegressionData { training: RegressionPoint[]; validation: RegressionPoint[]; }
function randomSource(seed: number) {
    let state = seed >>> 0;
    return () => { state = (1664525 * state + 1013904223) >>> 0; return (state + 0.5) / 4294967296; };
}
const normalSample = (random: () => number) => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
export function regressionTruth(input: number, nonlinear: boolean): number { return nonlinear ? Math.sin(Math.PI * input) : 1.2 * input - 0.2; }
export function createRegressionData(count = 12, noise = 0.25, nonlinear = true, outlier = false, seed = 27): RegressionData {
    if (!Number.isInteger(count) || count < 2 || !Number.isFinite(noise) || noise < 0) throw new Error('Use at least two samples and nonnegative finite noise.');
    const trainingRandom = randomSource(seed); const validationRandom = randomSource(seed + 9781);
    const make = (size: number, random: () => number, isTraining: boolean): RegressionPoint[] => Array.from({ length: size }, (_, index) => {
        const input = -1 + 2 * (index + 0.15 + 0.7 * random()) / size;
        const truth = regressionTruth(input, nonlinear);
        const target = truth + noise * normalSample(random) + (isTraining && outlier && index === Math.floor(size / 2) ? 2.5 : 0);
        return { input, target, truth };
    });
    return { training: make(count, trainingRandom, true), validation: make(80, validationRandom, false) };
}

/** Solve the positive definite regularized normal equations with partial pivoting. */
function solveLinear(matrix: number[][], vector: number[]): number[] {
    const size = vector.length;
    const rows = matrix.map((row, index) => [...row, vector[index]]);
    for (let column = 0; column < size; column++) {
        let pivot = column;
        for (let row = column + 1; row < size; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
        if (Math.abs(rows[pivot][column]) < 1e-14) throw new Error('Regression design is singular.');
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        for (let j = column; j <= size; j++) rows[column][j] /= divisor;
        for (let row = 0; row < size; row++) if (row !== column) {
            const factor = rows[row][column];
            for (let j = column; j <= size; j++) rows[row][j] -= factor * rows[column][j];
        }
    }
    return rows.map(row => row[size]);
}
export function fitPolynomial(points: readonly RegressionPoint[], degree: number, ridge = 1e-8): number[] {
    if (points.length === 0 || !Number.isInteger(degree) || degree < 0 || degree > 10 || ridge < 0) throw new Error('Invalid polynomial fitting parameters.');
    const size = degree + 1;
    const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
    const vector = Array.from({ length: size }, () => 0);
    for (const point of points) {
        const powers = Array.from({ length: size }, (_, index) => point.input ** index);
        for (let i = 0; i < size; i++) {
            vector[i] += powers[i] * point.target / points.length;
            for (let j = 0; j < size; j++) matrix[i][j] += powers[i] * powers[j] / points.length;
        }
    }
    for (let i = 0; i < size; i++) matrix[i][i] += ridge;
    return solveLinear(matrix, vector);
}
export function polynomialPrediction(input: number, coefficients: readonly number[]): number {
    return coefficients.reduceRight((value, coefficient) => value * input + coefficient, 0);
}
export function regressionMSE(points: readonly RegressionPoint[], coefficients: readonly number[]): number {
    return points.reduce((sum, point) => sum + (polynomialPrediction(point.input, coefficients) - point.target) ** 2, 0) / points.length;
}

export type Weight2 = [number, number];
export interface FeaturePoint { features: Weight2; target: number; }
export interface FeatureProblem { points: FeaturePoint[]; hessian: [Weight2, Weight2]; eigenvalues: Weight2; condition: number; optimum: Weight2; }

/** Exact orthogonal latent signals make scaling and correlation independently inspectable. */
export function createFeatureProblem(featureScale = 5, correlation = 0.6, standardize = false): FeatureProblem {
    if (!Number.isFinite(featureScale) || !(featureScale > 0) || !Number.isFinite(correlation) || Math.abs(correlation) >= 1) throw new Error('Use finite positive scale and correlation strictly inside (-1, 1).');
    const points: FeaturePoint[] = Array.from({ length: 36 }, (_, index) => {
        const angle = 2 * Math.PI * (index + 0.5) / 36;
        const first = Math.SQRT2 * Math.cos(angle); const independent = Math.SQRT2 * Math.sin(angle);
        const second = correlation * first + Math.sqrt(1 - correlation ** 2) * independent;
        return { features: [first, second * (standardize ? 1 : featureScale)], target: 1.2 * first - 0.7 * independent };
    });
    const a = points.reduce((sum, point) => sum + point.features[0] ** 2, 0) / points.length;
    const b = points.reduce((sum, point) => sum + point.features[0] * point.features[1], 0) / points.length;
    const c = points.reduce((sum, point) => sum + point.features[1] ** 2, 0) / points.length;
    const discriminant = Math.hypot(a - c, 2 * b);
    const largest = (a + c + discriminant) / 2;
    // Determinant/largest avoids subtractive cancellation for the smaller eigenvalue.
    const smallest = (a * c - b * b) / largest;
    const normal = [0, 1].map(i => points.reduce((sum, point) => sum + point.features[i] * point.target, 0) / points.length);
    const determinant = a * c - b * b;
    return { points, hessian: [[a, b], [b, c]], eigenvalues: [smallest, largest], condition: largest / smallest,
        optimum: [(c * normal[0] - b * normal[1]) / determinant, (a * normal[1] - b * normal[0]) / determinant] };
}
export function featureLoss(problem: FeatureProblem, weights: Weight2): number {
    return problem.points.reduce((sum, point) => sum + (weights[0] * point.features[0] + weights[1] * point.features[1] - point.target) ** 2 / 2, 0) / problem.points.length;
}
export function featureGradient(problem: FeatureProblem, weights: Weight2): Weight2 {
    return [0, 1].map(index => problem.points.reduce((sum, point) => {
        const residual = weights[0] * point.features[0] + weights[1] * point.features[1] - point.target;
        return sum + residual * point.features[index];
    }, 0) / problem.points.length) as Weight2;
}
export interface DescentStep { weights: Weight2; loss: number; }
export function featureDescent(problem: FeatureProblem, learningRate: number, iterations = 50): { steps: DescentStep[]; stopped: boolean } {
    if (!(learningRate > 0)) throw new Error('Learning rate must be positive.');
    const steps: DescentStep[] = [{ weights: [0, 0], loss: featureLoss(problem, [0, 0]) }];
    let stopped = false;
    for (let iteration = 0; iteration < iterations; iteration++) {
        const previous = steps.at(-1)!;
        const gradient = featureGradient(problem, previous.weights);
        const weights: Weight2 = [previous.weights[0] - learningRate * gradient[0], previous.weights[1] - learningRate * gradient[1]];
        const loss = featureLoss(problem, weights);
        if (!Number.isFinite(loss) || loss > 1e6) { stopped = true; break; }
        steps.push({ weights, loss });
    }
    return { steps, stopped };
}
