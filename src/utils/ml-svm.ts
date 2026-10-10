export type SVMCoordinate = [number, number, number];
export type SVMKernel = 'linear' | 'lift' | 'rbf';
export interface SVMObservation { x: SVMCoordinate; label: -1 | 1; }
export interface SVRObservation { x: SVMCoordinate; y: number; }
export interface SVMOptions { C?: number; kernel?: SVMKernel; gamma?: number; scale?: boolean; tolerance?: number; maxSweeps?: number; }
export interface SVMIteration { dualObjective: number; kktResidual: number; }
interface KernelModel {
    kernel: SVMKernel; gamma: number; C: number; means: SVMCoordinate; deviations: SVMCoordinate;
    features: SVMCoordinate[]; coefficients: number[]; bias: number;
    supportIndices: number[]; featureWeights: SVMCoordinate | null;
    trace: SVMIteration[]; converged: boolean; kktResidual: number; primalObjective: number; dualObjective: number;
}
export interface SVMModel extends KernelModel { alphas: number[]; }
export interface SVRModel extends KernelModel { epsilon: number; }

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));

/** This explicit three-dimensional map defines a toy kernel, not an RBF feature map. */
export function finiteSVMLift(x: SVMCoordinate): SVMCoordinate { return [x[0], x[1], x[0] ** 2 + x[1] ** 2]; }

function kernel(featuresA: SVMCoordinate, featuresB: SVMCoordinate, type: SVMKernel, gamma: number): number {
    return type === 'rbf' ? Math.exp(-gamma * featuresA.reduce((sum, value, index) => sum + (value - featuresB[index]) ** 2, 0)) : dot(featuresA, featuresB);
}

function prepare(xs: readonly SVMCoordinate[], options: SVMOptions) {
    const { C = 1, kernel: type = 'linear', gamma = 1, scale = false, tolerance = 0.002, maxSweeps = 400 } = options;
    if (xs.length < 2 || xs.some(x => x.length !== 3 || x.some(value => !Number.isFinite(value))) || !Number.isFinite(C) || C <= 0 || !Number.isFinite(gamma) || gamma <= 0 ||
        !Number.isFinite(tolerance) || tolerance <= 0 || !Number.isInteger(maxSweeps) || maxSweeps < 1) throw new RangeError('Supply finite points and positive SVM optimization settings.');
    const means = [0, 1, 2].map(axis => scale ? xs.reduce((sum, x) => sum + x[axis], 0) / xs.length : 0) as SVMCoordinate;
    const deviations = [0, 1, 2].map(axis => scale ? Math.sqrt(xs.reduce((sum, x) => sum + (x[axis] - means[axis]) ** 2, 0) / xs.length) || 1 : 1) as SVMCoordinate;
    const features = xs.map(x => {
        const normalized = x.map((value, axis) => (value - means[axis]) / deviations[axis]) as SVMCoordinate;
        return type === 'lift' ? finiteSVMLift(normalized) : normalized;
    });
    if (features.some(x => x.some(value => !Number.isFinite(value)))) throw new RangeError('Transformed features must be finite.');
    const gram = features.map(a => features.map(b => kernel(a, b, type, gamma)));
    return { C, type, gamma, tolerance, maxSweeps, means, deviations, features, gram };
}

export function svmFeaturePoint(model: Pick<KernelModel, 'kernel' | 'means' | 'deviations'>, x: SVMCoordinate): SVMCoordinate {
    const normalized = x.map((value, axis) => (value - model.means[axis]) / model.deviations[axis]) as SVMCoordinate;
    return model.kernel === 'lift' ? finiteSVMLift(normalized) : normalized;
}

export function svmPrediction(model: KernelModel, x: SVMCoordinate): number {
    const point = svmFeaturePoint(model, x);
    return model.bias + model.coefficients.reduce((sum, value, index) => sum + value * kernel(model.features[index], point, model.kernel, model.gamma), 0);
}

function featureWeights(features: readonly SVMCoordinate[], coefficients: readonly number[], type: SVMKernel): SVMCoordinate | null {
    return type === 'rbf' ? null : [0, 1, 2].map(axis => coefficients.reduce((sum, value, index) => sum + value * features[index][axis], 0)) as SVMCoordinate;
}

function classificationBias(labels: readonly number[], alphas: readonly number[], scores: readonly number[], C: number): number {
    const bound = Math.min(C / 4, Math.max(1e-10, C * 1e-7));
    const free = alphas.flatMap((alpha, index) => alpha > bound && alpha < C - bound ? [labels[index] - scores[index]] : []);
    if (free.length) return free.reduce((sum, value) => sum + value, 0) / free.length;
    let lower = -Infinity; let upper = Infinity;
    alphas.forEach((alpha, index) => {
        const value = labels[index] - scores[index];
        if (labels[index] > 0 ? alpha <= bound : alpha >= C - bound) lower = Math.max(lower, value);
        else upper = Math.min(upper, value);
    });
    return Number.isFinite(lower) && Number.isFinite(upper) ? (lower + upper) / 2 : Number.isFinite(lower) ? lower : Number.isFinite(upper) ? upper : 0;
}

/** Cyclic exact feasible pair-coordinate ascent on the soft-margin SVM dual. */
export function fitSVM(samples: readonly SVMObservation[], options: SVMOptions = {}): SVMModel {
    if (samples.some(sample => sample.label !== -1 && sample.label !== 1)) throw new RangeError('Binary labels must be -1 or +1.');
    const prepared = prepare(samples.map(sample => sample.x), options);
    const { C, gram, tolerance, maxSweeps } = prepared;
    const labels = samples.map(sample => sample.label);
    const alphas = new Array<number>(samples.length).fill(0);
    const scores = new Array<number>(samples.length).fill(0);
    const trace: SVMIteration[] = [];
    let bias = 0; let kktResidual = Infinity; let dualObjective = 0;
    const measure = () => {
        bias = classificationBias(labels, alphas, scores, C);
        const bound = Math.min(C / 4, Math.max(1e-10, C * 1e-7));
        kktResidual = Math.max(...alphas.map((alpha, index) => {
            const margin = labels[index] * (scores[index] + bias);
            return alpha <= bound ? Math.max(0, 1 - margin) : alpha >= C - bound ? Math.max(0, margin - 1) : Math.abs(margin - 1);
        }));
        dualObjective = alphas.reduce((sum, value, index) => sum + value - 0.5 * value * labels[index] * scores[index], 0);
        trace.push({ dualObjective, kktResidual });
    };
    measure();
    for (let sweep = 0; sweep < maxSweeps && kktResidual > tolerance; sweep++) {
        for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
            const lower = Math.max(labels[i] > 0 ? -alphas[i] : alphas[i] - C, labels[j] > 0 ? alphas[j] - C : -alphas[j]);
            const upper = Math.min(labels[i] > 0 ? C - alphas[i] : alphas[i], labels[j] > 0 ? alphas[j] : C - alphas[j]);
            const derivative = labels[i] - labels[j] - (scores[i] - scores[j]);
            const curvature = Math.max(0, gram[i][i] + gram[j][j] - 2 * gram[i][j]);
            const step = curvature > 1e-14 ? clamp(derivative / curvature, lower, upper) : derivative > 0 ? upper : lower;
            if (Math.abs(step) < 1e-12) continue;
            const oldI = alphas[i]; const oldJ = alphas[j];
            alphas[i] = clamp(oldI + labels[i] * step, 0, C);
            alphas[j] = clamp(oldJ - labels[j] * step, 0, C);
            const deltaI = (alphas[i] - oldI) * labels[i]; const deltaJ = (alphas[j] - oldJ) * labels[j];
            for (let k = 0; k < samples.length; k++) scores[k] += deltaI * gram[k][i] + deltaJ * gram[k][j];
        }
        measure();
    }
    const coefficients = alphas.map((value, index) => value * labels[index]);
    const normSquared = dot(coefficients, scores);
    const primalObjective = 0.5 * normSquared + C * labels.reduce((sum, label, index) => sum + Math.max(0, 1 - label * (scores[index] + bias)), 0);
    return { kernel: prepared.type, gamma: prepared.gamma, C, means: prepared.means, deviations: prepared.deviations, features: prepared.features,
        coefficients, alphas, bias, supportIndices: alphas.flatMap((value, index) => value > 1e-7 ? [index] : []),
        featureWeights: featureWeights(prepared.features, coefficients, prepared.type), trace, converged: kktResidual <= tolerance, kktResidual, primalObjective, dualObjective };
}

function regressionBias(targets: readonly number[], coefficients: readonly number[], scores: readonly number[], C: number, epsilon: number): number {
    const bound = Math.min(C / 4, Math.max(1e-10, C * 1e-7));
    const free = coefficients.flatMap((coefficient, index) => Math.abs(coefficient) > bound && Math.abs(coefficient) < C - bound ? [targets[index] - scores[index] - Math.sign(coefficient) * epsilon] : []);
    if (free.length) return free.reduce((sum, value) => sum + value, 0) / free.length;
    let lower = -Infinity; let upper = Infinity;
    coefficients.forEach((coefficient, index) => {
        const value = targets[index] - scores[index];
        if (coefficient >= C - bound) upper = Math.min(upper, value - epsilon);
        else if (coefficient <= -C + bound) lower = Math.max(lower, value + epsilon);
        else { lower = Math.max(lower, value - epsilon); upper = Math.min(upper, value + epsilon); }
    });
    return Number.isFinite(lower) && Number.isFinite(upper) ? (lower + upper) / 2 : Number.isFinite(lower) ? lower : Number.isFinite(upper) ? upper : 0;
}

/** Exact piecewise-quadratic pair updates for the ε-insensitive SVR dual. */
export function fitSVR(samples: readonly SVRObservation[], options: SVMOptions & { epsilon?: number } = {}): SVRModel {
    const epsilon = options.epsilon ?? 0.15;
    if (!Number.isFinite(epsilon) || epsilon < 0 || samples.some(sample => !Number.isFinite(sample.y))) throw new RangeError('SVR targets must be finite; epsilon must be nonnegative.');
    const prepared = prepare(samples.map(sample => sample.x), options);
    const { C, gram, tolerance, maxSweeps } = prepared;
    const targets = samples.map(sample => sample.y);
    const coefficients = new Array<number>(samples.length).fill(0);
    const scores = new Array<number>(samples.length).fill(0);
    const trace: SVMIteration[] = [];
    let bias = 0; let kktResidual = Infinity; let dualObjective = 0;
    const measure = () => {
        bias = regressionBias(targets, coefficients, scores, C, epsilon);
        const bound = Math.min(C / 4, Math.max(1e-10, C * 1e-7));
        kktResidual = Math.max(...coefficients.map((coefficient, index) => {
            const residual = targets[index] - scores[index] - bias;
            if (Math.abs(coefficient) <= bound) return Math.max(0, Math.abs(residual) - epsilon);
            if (coefficient >= C - bound) return Math.max(0, epsilon - residual);
            if (coefficient <= -C + bound) return Math.max(0, epsilon + residual);
            return Math.abs(residual - Math.sign(coefficient) * epsilon);
        }));
        dualObjective = coefficients.reduce((sum, coefficient, index) => sum + targets[index] * coefficient - 0.5 * coefficient * scores[index] - epsilon * Math.abs(coefficient), 0);
        trace.push({ dualObjective, kktResidual });
    };
    measure();
    for (let sweep = 0; sweep < maxSweeps && kktResidual > tolerance; sweep++) {
        for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
            const lower = Math.max(-C - coefficients[i], coefficients[j] - C);
            const upper = Math.min(C - coefficients[i], coefficients[j] + C);
            const derivative = targets[i] - targets[j] - (scores[i] - scores[j]);
            const curvature = Math.max(0, gram[i][i] + gram[j][j] - 2 * gram[i][j]);
            const cuts = [...new Set([lower, upper, 0, -coefficients[i], coefficients[j]].filter(value => value >= lower && value <= upper))].sort((a, b) => a - b);
            const candidates = [...cuts];
            if (curvature > 1e-14) for (let index = 1; index < cuts.length; index++) {
                const midpoint = (cuts[index - 1] + cuts[index]) / 2;
                const penalty = epsilon * (Math.sign(coefficients[i] + midpoint) - Math.sign(coefficients[j] - midpoint));
                candidates.push(clamp((derivative - penalty) / curvature, cuts[index - 1], cuts[index]));
            }
            let step = 0; let bestGain = 0;
            for (const candidate of candidates) {
                const gain = derivative * candidate - 0.5 * curvature * candidate * candidate - epsilon * (Math.abs(coefficients[i] + candidate) + Math.abs(coefficients[j] - candidate) - Math.abs(coefficients[i]) - Math.abs(coefficients[j]));
                if (gain > bestGain) { bestGain = gain; step = candidate; }
            }
            if (Math.abs(step) < 1e-12 || bestGain < 1e-14) continue;
            coefficients[i] = clamp(coefficients[i] + step, -C, C); coefficients[j] = clamp(coefficients[j] - step, -C, C);
            for (let k = 0; k < samples.length; k++) scores[k] += step * (gram[k][i] - gram[k][j]);
        }
        measure();
    }
    const normSquared = dot(coefficients, scores);
    const primalObjective = 0.5 * normSquared + C * targets.reduce((sum, target, index) => sum + Math.max(0, Math.abs(target - scores[index] - bias) - epsilon), 0);
    return { kernel: prepared.type, gamma: prepared.gamma, C, means: prepared.means, deviations: prepared.deviations, features: prepared.features, coefficients, bias, epsilon,
        supportIndices: coefficients.flatMap((value, index) => Math.abs(value) > 1e-7 ? [index] : []), featureWeights: featureWeights(prepared.features, coefficients, prepared.type),
        trace, converged: kktResidual <= tolerance, kktResidual, primalObjective, dualObjective };
}

export function svmRawLinearPlane(model: KernelModel): { weights: SVMCoordinate; bias: number } | null {
    if (model.kernel !== 'linear' || !model.featureWeights) return null;
    const weights = model.featureWeights.map((value, axis) => value / model.deviations[axis]) as SVMCoordinate;
    return { weights, bias: model.bias - dot(weights, model.means) };
}
