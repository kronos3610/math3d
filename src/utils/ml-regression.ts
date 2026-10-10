import { sampleNormal, seededRandom } from './regression';

export type RegressionBasis = 'linear' | 'interaction' | 'quadratic';
export type RegressionSolver = 'qr' | 'svd' | 'gd' | 'sgd' | 'minibatch' | 'newton';
export type RegressionPreset = 'linear' | 'curved' | 'heteroskedastic' | 'correlated-errors' | 'non-gaussian' | 'collinear' | 'outlier' | 'confounded';
export interface RegressionObservation { x1: number; x2: number; y: number; weight?: number; noiseStd?: number; hidden?: number; }
export interface RegressionIteration { coefficients: number[]; loss: number; }
export interface MLRegressionFit {
    coefficients: number[]; rank: number; conditionNumber: number; singularValues: number[];
    trace: RegressionIteration[]; method: string; gradientNorm: number; converged: boolean;
}
export interface RegressionFitOptions { basis?: RegressionBasis; solver?: RegressionSolver; ridge?: number; learningRate?: number; iterations?: number; batchSize?: number; seed?: number; }

export function regressionFeatures(x1: number, x2: number, basis: RegressionBasis = 'linear'): number[] {
    return basis === 'quadratic' ? [1, x1, x2, x1 * x1, x1 * x2, x2 * x2]
        : basis === 'interaction' ? [1, x1, x2, x1 * x2] : [1, x1, x2];
}

export function regressionPrediction(coefficients: readonly number[], x1: number, x2: number, basis: RegressionBasis = 'linear'): number {
    const features = regressionFeatures(x1, x2, basis);
    return coefficients.reduce((sum, coefficient, index) => sum + coefficient * features[index], 0);
}

interface SVDFactorization { columns: number[][]; right: number[][]; values: number[]; rank: number; }

/** One-sided Jacobi SVD orthogonalizes A directly, without forming AᵀA. */
function jacobiSVD(matrix: readonly (readonly number[])[]): SVDFactorization {
    const width = matrix[0].length;
    const columns = Array.from({ length: width }, (_, column) => matrix.map(row => row[column]));
    const right = Array.from({ length: width }, (_, column) => Array.from({ length: width }, (_, row) => Number(row === column)));
    for (let sweep = 0; sweep < 100; sweep++) {
        let changed = false;
        for (let p = 0; p < width; p++) for (let q = p + 1; q < width; q++) {
            let a = 0; let b = 0; let cross = 0;
            for (let row = 0; row < matrix.length; row++) {
                a += columns[p][row] ** 2; b += columns[q][row] ** 2;
                cross += columns[p][row] * columns[q][row];
            }
            if (Math.abs(cross) <= 1e-13 * Math.sqrt(a * b) || cross === 0) continue;
            const tau = (b - a) / (2 * cross);
            const tangent = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.hypot(1, tau));
            const cosine = 1 / Math.hypot(1, tangent); const sine = cosine * tangent;
            for (const pair of [[columns[p], columns[q]], [right[p], right[q]]]) {
                for (let row = 0; row < pair[0].length; row++) {
                    const first = pair[0][row]; const second = pair[1][row];
                    pair[0][row] = cosine * first - sine * second;
                    pair[1][row] = sine * first + cosine * second;
                }
            }
            changed = true;
        }
        if (!changed) break;
    }
    const values = columns.map(column => Math.hypot(...column));
    const maximum = Math.max(...values);
    const tolerance = Math.max(1e-12, maximum * 1e-10);
    return { columns, right, values, rank: values.filter(value => value > tolerance).length };
}

function solveSVD(matrix: readonly (readonly number[])[], target: readonly number[]): { coefficients: number[]; factorization: SVDFactorization } {
    const factorization = jacobiSVD(matrix);
    const maximum = Math.max(...factorization.values);
    const coefficients = new Array<number>(matrix[0].length).fill(0);
    factorization.values.forEach((value, index) => {
        if (value <= Math.max(1e-12, maximum * 1e-10)) return;
        const projection = factorization.columns[index].reduce((sum, coordinate, row) => sum + coordinate * target[row], 0) / (value * value);
        factorization.right[index].forEach((coordinate, column) => { coefficients[column] += coordinate * projection; });
    });
    return { coefficients, factorization };
}

function solveQR(matrix: readonly (readonly number[])[], target: readonly number[]): number[] | null {
    const width = matrix[0].length;
    const columns = Array.from({ length: width }, (_, index) => matrix.map(row => row[index]));
    const upper = Array.from({ length: width }, () => new Array<number>(width).fill(0));
    const projected = new Array<number>(width).fill(0);
    for (let column = 0; column < width; column++) {
        for (let pass = 0; pass < 2; pass++) for (let previous = 0; previous < column; previous++) {
            const dot = columns[previous].reduce((sum, value, row) => sum + value * columns[column][row], 0);
            upper[previous][column] += dot;
            columns[column].forEach((value, row) => { columns[column][row] = value - dot * columns[previous][row]; });
        }
        const norm = Math.hypot(...columns[column]);
        if (norm < 1e-10) return null;
        upper[column][column] = norm;
        columns[column].forEach((value, row) => { columns[column][row] = value / norm; projected[column] += value / norm * target[row]; });
    }
    const coefficients = new Array<number>(width).fill(0);
    for (let column = width - 1; column >= 0; column--) {
        let value = projected[column];
        for (let next = column + 1; next < width; next++) value -= upper[column][next] * coefficients[next];
        coefficients[column] = value / upper[column][column];
    }
    return coefficients;
}

export function regressionLoss(samples: readonly RegressionObservation[], coefficients: readonly number[], basis: RegressionBasis = 'linear', ridge = 0): number {
    const totalWeight = samples.reduce((sum, sample) => sum + (sample.weight ?? 1), 0);
    const error = samples.reduce((sum, sample) => sum + (sample.weight ?? 1) * (regressionPrediction(coefficients, sample.x1, sample.x2, basis) - sample.y) ** 2, 0);
    return error / (2 * totalWeight) + ridge / 2 * coefficients.slice(1).reduce((sum, coefficient) => sum + coefficient * coefficient, 0);
}

export function regressionMSE(samples: readonly RegressionObservation[], coefficients: readonly number[], basis: RegressionBasis = 'linear'): number {
    return samples.reduce((sum, sample) => sum + (regressionPrediction(coefficients, sample.x1, sample.x2, basis) - sample.y) ** 2, 0) / samples.length;
}

export function fitMLRegression(samples: readonly RegressionObservation[], options: RegressionFitOptions = {}): MLRegressionFit {
    const { basis = 'linear', solver = 'qr', ridge = 0, learningRate = 0.5, iterations = 100, batchSize = 8, seed = 31 } = options;
    if (samples.length === 0 || !Number.isFinite(ridge) || ridge < 0 || !Number.isFinite(learningRate) || learningRate <= 0 || !Number.isInteger(iterations) || iterations < 1 ||
        !Number.isInteger(batchSize) || batchSize < 1 || samples.some(sample => ![sample.x1, sample.x2, sample.y, sample.weight ?? 1].every(Number.isFinite) || (sample.weight ?? 1) < 0)) {
        throw new RangeError('Provide finite observations, nonnegative weights/ridge, and valid iteration settings.');
    }
    const totalWeight = samples.reduce((sum, sample) => sum + (sample.weight ?? 1), 0);
    if (totalWeight <= 0) throw new RangeError('At least one observation must have positive weight.');
    const features = samples.map(sample => regressionFeatures(sample.x1, sample.x2, basis));
    if (features.some(row => row.some(value => !Number.isFinite(value)))) throw new RangeError('Feature values must remain finite.');
    const width = features[0].length;
    const weights = samples.map(sample => (sample.weight ?? 1) / totalWeight);
    const design = features.map((row, index) => row.map(value => value * Math.sqrt(weights[index])));
    const target = samples.map((sample, index) => sample.y * Math.sqrt(weights[index]));
    const dataSVD = jacobiSVD(design);
    const singularValues = [...dataSVD.values].sort((a, b) => b - a);
    const conditionNumber = dataSVD.rank < width ? Infinity : singularValues[0] / singularValues[width - 1];
    const augmented = design.map(row => [...row]); const augmentedTarget = [...target];
    if (ridge > 0) for (let column = 1; column < width; column++) {
        const row = new Array<number>(width).fill(0); row[column] = Math.sqrt(ridge);
        augmented.push(row); augmentedTarget.push(0);
    }
    const reference = solveSVD(augmented, augmentedTarget).coefficients;
    let coefficients: number[];
    let method: string = solver.toUpperCase();
    const effectiveBatch = solver === 'sgd' ? 1 : Math.min(batchSize, samples.length);
    if (solver === 'minibatch') method = `Mini-batch GD (batch ${effectiveBatch})`;
    const means = Array.from({ length: width }, (_, column) => features.reduce((sum, row, index) => sum + weights[index] * row[column], 0));
    const targetMean = samples.reduce((sum, sample, index) => sum + weights[index] * sample.y, 0);
    const profileIntercept = (values: number[]) => { values[0] = targetMean - values.slice(1).reduce((sum, value, column) => sum + value * means[column + 1], 0); };
    const trace: RegressionIteration[] = [];
    if (solver === 'qr' || solver === 'svd') {
        const qr = solver === 'qr' ? solveQR(augmented, augmentedTarget) : null;
        coefficients = qr ?? reference;
        if (solver === 'qr' && !qr) method = 'SVD (rank-deficient QR fallback)';
        const initial = new Array<number>(width).fill(0); initial[0] = targetMean;
        trace.push({ coefficients: initial, loss: regressionLoss(samples, initial, basis, ridge) }, { coefficients: [...coefficients], loss: regressionLoss(samples, coefficients, basis, ridge) });
    } else {
        coefficients = new Array<number>(width).fill(0); profileIntercept(coefficients);
        trace.push({ coefficients: [...coefficients], loss: regressionLoss(samples, coefficients, basis, ridge) });
        const random = seededRandom(seed);
        const order = Array.from({ length: samples.length }, (_, index) => index);
        for (let iteration = 0; iteration < iterations; iteration++) {
            if (solver === 'newton') coefficients = [...reference];
            else {
                const gradient = new Array<number>(width).fill(0);
                if (solver === 'sgd' || solver === 'minibatch') {
                    // Partial Fisher–Yates gives an unbiased subset without replacement.
                    for (let draw = 0; draw < effectiveBatch; draw++) {
                        const chosen = draw + Math.min(samples.length - draw - 1, Math.floor(random() * (samples.length - draw)));
                        [order[draw], order[chosen]] = [order[chosen], order[draw]];
                        const index = order[draw];
                        const residual = regressionPrediction(coefficients, samples[index].x1, samples[index].x2, basis) - samples[index].y;
                        for (let column = 1; column < width; column++) gradient[column] += samples.length * weights[index] / effectiveBatch * residual * (features[index][column] - means[column]);
                    }
                } else for (let index = 0; index < samples.length; index++) {
                    const residual = regressionPrediction(coefficients, samples[index].x1, samples[index].x2, basis) - samples[index].y;
                    for (let column = 1; column < width; column++) gradient[column] += weights[index] * residual * (features[index][column] - means[column]);
                }
                for (let column = 1; column < width; column++) gradient[column] += ridge * coefficients[column];
                const rate = solver === 'sgd' ? learningRate / Math.sqrt(1 + iteration / 8)
                    : solver === 'minibatch' && effectiveBatch < samples.length ? learningRate / Math.sqrt(1 + iteration / 20) : learningRate;
                for (let column = 1; column < width; column++) coefficients[column] -= rate * gradient[column];
                profileIntercept(coefficients);
            }
            const loss = regressionLoss(samples, coefficients, basis, ridge);
            if (!Number.isFinite(loss) || loss > 1e12) { coefficients = [...trace[trace.length - 1].coefficients]; break; }
            trace.push({ coefficients: [...coefficients], loss });
            if (solver === 'newton') break; // Exact quadratic Newton step, solved by SVD.
        }
    }
    const gradient = new Array<number>(width).fill(0);
    samples.forEach((sample, index) => {
        const residual = regressionPrediction(coefficients, sample.x1, sample.x2, basis) - sample.y;
        features[index].forEach((value, column) => { gradient[column] += weights[index] * value * residual; });
    });
    for (let column = 1; column < width; column++) gradient[column] += ridge * coefficients[column];
    const gradientNorm = Math.hypot(...gradient);
    return { coefficients, rank: dataSVD.rank, conditionNumber, singularValues, trace, method, gradientNorm, converged: gradientNorm < 1e-4 };
}

export type ResponseVector = [number, number, number];
export interface ThreeObservationProjection {
    response: ResponseVector; fitted: ResponseVector; residual: ResponseVector;
    featureColumn: ResponseVector; interceptColumn: ResponseVector;
    coefficients: [number, number]; rank: number; errorNorm: number;
    residualInterceptDot: number; residualFeatureDot: number;
}

/** The three response coordinates are three observations, not input/response plot axes. */
export function projectThreeObservations(featureColumn: ResponseVector, response: ResponseVector): ThreeObservationProjection {
    const samples = featureColumn.map((x1, index) => ({ x1, x2: 0, y: response[index] }));
    const fit = fitMLRegression(samples, { solver: 'svd' });
    const fitted = samples.map(sample => regressionPrediction(fit.coefficients, sample.x1, 0)) as ResponseVector;
    const residual = response.map((value, index) => value - fitted[index]) as ResponseVector;
    return { response: [...response], fitted, residual, featureColumn: [...featureColumn], interceptColumn: [1, 1, 1],
        coefficients: [fit.coefficients[0], fit.coefficients[1]], rank: fit.rank, errorNorm: Math.hypot(...residual),
        residualInterceptDot: residual.reduce((sum, value) => sum + value, 0),
        residualFeatureDot: residual.reduce((sum, value, index) => sum + value * featureColumn[index], 0) };
}

export function generateRegressionData({ preset = 'linear', sampleSize = 48, noiseStd = 0.2, correlation = 0, seed = 73 }: {
    preset?: RegressionPreset; sampleSize?: number; noiseStd?: number; correlation?: number; seed?: number;
} = {}): RegressionObservation[] {
    if (!Number.isInteger(sampleSize) || sampleSize < 3 || !Number.isFinite(noiseStd) || noiseStd < 0 || !Number.isFinite(correlation) || Math.abs(correlation) > 1) throw new RangeError('Invalid regression simulation settings.');
    const random = seededRandom(seed);
    // Stationary initialization keeps every AR(1) error's variance equal to σ².
    let lastNoise = preset === 'correlated-errors' ? sampleNormal(random) : 0;
    return Array.from({ length: sampleSize }, (_, index) => {
        const hidden = 2 * random() - 1;
        const independent = 2 * random() - 1;
        const x1 = preset === 'confounded' ? 0.7 * hidden + 0.3 * independent : hidden;
        const rho = preset === 'collinear' ? 1 : correlation;
        // The confounded input has variance (0.7² + 0.3²)/3 rather than 1/3.
        const correlationInput = preset === 'confounded' ? x1 / Math.sqrt(0.7 ** 2 + 0.3 ** 2) : x1;
        const x2 = rho * correlationInput + Math.sqrt(Math.max(0, 1 - rho * rho)) * (2 * random() - 1);
        const sigma = preset === 'heteroskedastic' ? noiseStd * (0.2 + 1.8 * Math.abs(x1)) : noiseStd;
        const normal = sampleNormal(random);
        const standardized = preset === 'correlated-errors' ? 0.85 * lastNoise + Math.sqrt(1 - 0.85 ** 2) * normal : preset === 'non-gaussian' ? Math.sqrt(3) * (2 * random() - 1) : normal;
        lastNoise = standardized;
        const mean = 0.3 + 1.2 * x1 - 0.8 * x2 + (preset === 'curved' ? 1.2 * x1 * x1 - 0.7 * x1 * x2 : 0) + (preset === 'confounded' ? 1.4 * hidden : 0);
        return { x1, x2, y: mean + sigma * standardized + (preset === 'outlier' && index === 0 ? 3.5 : 0), noiseStd: sigma, hidden };
    });
}

export function residualLagCorrelation(samples: readonly RegressionObservation[], coefficients: readonly number[], basis: RegressionBasis = 'linear'): number {
    const residuals = samples.map(sample => sample.y - regressionPrediction(coefficients, sample.x1, sample.x2, basis));
    const mean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
    const denominator = residuals.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    return denominator > 1e-14 ? residuals.slice(1).reduce((sum, value, index) => sum + (value - mean) * (residuals[index] - mean), 0) / denominator : 0;
}
