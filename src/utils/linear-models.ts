import { seededRandom } from './regression';

export type LinearAlgorithm = 'logistic' | 'least-squares' | 'perceptron';
export type BinaryClass = 0 | 1;
export type LinearWeights = [number, number, number];

export interface ClassificationPoint {
    x1: number;
    x2: number;
    target: BinaryClass;
}

export interface PlotPoint {
    x1: number;
    x2: number;
}

export interface LinearFit {
    weights: LinearWeights;
    converged: boolean;
    iterations: number;
}

export function sigmoid(value: number): number {
    if (value >= 0) return 1 / (1 + Math.exp(-value));
    const exponential = Math.exp(value);
    return exponential / (1 + exponential);
}

export function linearScore(weights: readonly number[], point: PlotPoint): number {
    return weights[0] + weights[1] * point.x1 + weights[2] * point.x2;
}

export function classificationThreshold(algorithm: LinearAlgorithm): number {
    return algorithm === 'least-squares' ? 0.5 : 0;
}

export function predictClass(weights: readonly number[], algorithm: LinearAlgorithm, point: PlotPoint): BinaryClass {
    return linearScore(weights, point) >= classificationThreshold(algorithm) ? 1 : 0;
}

function solveLinearSystem(matrix: readonly number[][], target: readonly number[]): LinearWeights {
    const rows = matrix.map((row, index) => [...row, target[index]]);
    for (let column = 0; column < 3; column++) {
        let pivot = column;
        for (let row = column + 1; row < 3; row++) {
            if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
        }
        [rows[pivot], rows[column]] = [rows[column], rows[pivot]];
        const divisor = rows[column][column];
        if (Math.abs(divisor) < 1e-14) throw new RangeError('The linear system is singular.');
        for (let j = column; j < 4; j++) rows[column][j] /= divisor;
        for (let row = 0; row < 3; row++) {
            if (row === column) continue;
            const factor = rows[row][column];
            for (let j = column; j < 4; j++) rows[row][j] -= factor * rows[column][j];
        }
    }
    return [rows[0][3], rows[1][3], rows[2][3]];
}

function fitLeastSquares(points: readonly ClassificationPoint[]): LinearFit {
    const matrix = [[0.01, 0, 0], [0, 0.01, 0], [0, 0, 0.01]];
    const target = [0, 0, 0];
    for (const point of points) {
        const row = [1, point.x1, point.x2];
        for (let i = 0; i < 3; i++) {
            target[i] += row[i] * point.target;
            for (let j = 0; j < 3; j++) matrix[i][j] += row[i] * row[j];
        }
    }
    return { weights: solveLinearSystem(matrix, target), converged: true, iterations: 1 };
}

function logisticObjective(points: readonly ClassificationPoint[], weights: LinearWeights): number {
    let loss = 0;
    for (const point of points) {
        const score = linearScore(weights, point);
        // log(1 + exp(score)) - target * score, without overflow.
        loss += Math.max(score, 0) + Math.log1p(Math.exp(-Math.abs(score))) - point.target * score;
    }
    return loss + 0.0005 * weights[0] ** 2 + 0.025 * (weights[1] ** 2 + weights[2] ** 2);
}

function fitLogistic(points: readonly ClassificationPoint[]): LinearFit {
    let weights: LinearWeights = [0, 0, 0];
    const penalties = [0.001, 0.05, 0.05];
    for (let iteration = 0; iteration < 50; iteration++) {
        const gradient = weights.map((value, index) => value * penalties[index]);
        const hessian = penalties.map((penalty, index) => penalties.map((_, column) => index === column ? penalty : 0));
        for (const point of points) {
            const row = [1, point.x1, point.x2];
            const probability = sigmoid(linearScore(weights, point));
            const variance = probability * (1 - probability);
            for (let i = 0; i < 3; i++) {
                gradient[i] += (probability - point.target) * row[i];
                for (let j = 0; j < 3; j++) hessian[i][j] += variance * row[i] * row[j];
            }
        }
        if (Math.hypot(...gradient) < 1e-7) return { weights, converged: true, iterations: iteration };
        const update = solveLinearSystem(hessian, gradient);
        const loss = logisticObjective(points, weights);
        let step = 1;
        let candidate: LinearWeights = [weights[0] - update[0], weights[1] - update[1], weights[2] - update[2]];
        while (logisticObjective(points, candidate) > loss && step > 1 / 1024) {
            step /= 2;
            candidate = [weights[0] - step * update[0], weights[1] - step * update[1], weights[2] - step * update[2]];
        }
        weights = candidate;
        if (step * Math.hypot(...update) < 1e-7) return { weights, converged: true, iterations: iteration + 1 };
    }
    return { weights, converged: false, iterations: 50 };
}

function fitPerceptron(points: readonly ClassificationPoint[]): LinearFit {
    const weights: LinearWeights = [0, 0, 0];
    for (let iteration = 0; iteration < 1000; iteration++) {
        let mistakes = 0;
        for (const point of points) {
            const target = point.target === 1 ? 1 : -1;
            if (linearScore(weights, point) * target <= 0) {
                weights[0] += 0.1 * target;
                weights[1] += 0.1 * target * point.x1;
                weights[2] += 0.1 * target * point.x2;
                mistakes++;
            }
        }
        if (mistakes === 0) return { weights, converged: true, iterations: iteration + 1 };
    }
    return { weights, converged: false, iterations: 1000 };
}

export function fitLinearClassifier(points: readonly ClassificationPoint[], algorithm: LinearAlgorithm): LinearFit {
    if (points.length < 2) return { weights: [0, 0, 0], converged: false, iterations: 0 };
    if (algorithm === 'least-squares') return fitLeastSquares(points);
    if (algorithm === 'logistic') return fitLogistic(points);
    return fitPerceptron(points);
}

export function exampleClassificationPoints(seed: number): ClassificationPoint[] {
    const random = seededRandom(seed);
    return Array.from({ length: 24 }, (_, index) => {
        const target = index % 2 === 0 ? 1 : 0;
        const center = target === 1 ? -0.4 : 0.4;
        return { x1: center + random() * 0.55 - 0.275, x2: center + random() * 0.55 - 0.275, target };
    });
}

/** Clip a half-plane against the plot square. No per-cell region shading is needed. */
export function classificationRegion(weights: readonly number[], algorithm: LinearAlgorithm, target: BinaryClass): PlotPoint[] {
    const corners: PlotPoint[] = [{ x1: -1, x2: -1 }, { x1: 1, x2: -1 }, { x1: 1, x2: 1 }, { x1: -1, x2: 1 }];
    if (weights[1] === 0 && weights[2] === 0) {
        return predictClass(weights, algorithm, { x1: 0, x2: 0 }) === target ? corners : [];
    }
    const sign = target === 1 ? 1 : -1;
    const distance = (point: PlotPoint) => sign * (linearScore(weights, point) - classificationThreshold(algorithm));
    const polygon: PlotPoint[] = [];
    for (let i = 0; i < corners.length; i++) {
        const start = corners[i];
        const end = corners[(i + 1) % corners.length];
        const startDistance = distance(start);
        const endDistance = distance(end);
        if (startDistance >= 0) polygon.push(start);
        if ((startDistance >= 0) !== (endDistance >= 0)) {
            const fraction = startDistance / (startDistance - endDistance);
            polygon.push({ x1: start.x1 + fraction * (end.x1 - start.x1), x2: start.x2 + fraction * (end.x2 - start.x2) });
        }
    }
    return polygon;
}

/** Find the visible segment of w0 + w1*x1 + w2*x2 = threshold, including vertical lines. */
export function decisionBoundary(weights: readonly number[], algorithm: LinearAlgorithm): [PlotPoint, PlotPoint] | null {
    const [intercept, xWeight, yWeight] = weights;
    const offset = classificationThreshold(algorithm) - intercept;
    const intersections: PlotPoint[] = [];
    const add = (x1: number, x2: number) => {
        if (Math.abs(x1) > 1 + 1e-9 || Math.abs(x2) > 1 + 1e-9) return;
        const point = { x1: Math.max(-1, Math.min(1, x1)), x2: Math.max(-1, Math.min(1, x2)) };
        if (!intersections.some(existing => Math.hypot(existing.x1 - point.x1, existing.x2 - point.x2) < 1e-9)) intersections.push(point);
    };
    if (Math.abs(yWeight) > 1e-12) {
        add(-1, (offset + xWeight) / yWeight);
        add(1, (offset - xWeight) / yWeight);
    }
    if (Math.abs(xWeight) > 1e-12) {
        add((offset + yWeight) / xWeight, -1);
        add((offset - yWeight) / xWeight, 1);
    }
    return intersections.length >= 2 ? [intersections[0], intersections[1]] : null;
}
