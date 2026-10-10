import { sampleNormal, seededRandom } from './regression';

export type TreeTask = 'classification' | 'regression';
export type TreeGrowth = 'depthwise' | 'leafwise';
export interface TreeSample { x: number[]; y: number }
export interface TreeNode {
    id: number; depth: number; indices: number[]; value: number; risk: number;
    feature?: number; threshold?: number; gain?: number; left?: TreeNode; right?: TreeNode;
    gradient?: number; hessian?: number;
}
export interface NewtonOptions { gradients: number[]; hessians: number[]; lambda: number; gamma: number }
export interface TreeOptions {
    task?: TreeTask; maxDepth?: number; minLeaf?: number; pruning?: number;
    maxFeatures?: number; seed?: number; bins?: number; growth?: TreeGrowth; maxLeaves?: number;
    weights?: number[]; newton?: NewtonOptions;
}
interface Split { feature: number; threshold: number; gain: number; left: number[]; right: number[] }
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
export const treeSigmoid = (value: number) => value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));

export function histogramCuts(values: readonly number[], bins: number): number[] {
    const unique = [...new Set(values)].sort((a, b) => a - b);
    if (unique.length < 2) return [];
    const count = Math.min(Math.max(2, Math.floor(bins)), unique.length);
    const cuts = new Set<number>();
    for (let bin = 1; bin < count; bin++) {
        const index = Math.max(1, Math.floor(bin * unique.length / count));
        cuts.add((unique[index - 1] + unique[index]) / 2);
    }
    return [...cuts];
}

/** Exact Newton gain for one added leaf, including the split penalty gamma. */
export function newtonSplitGain(gl: number, hl: number, gr: number, hr: number, lambda: number, gamma: number): number {
    const score = (g: number, h: number) => h + lambda > 0 ? g * g / (h + lambda) : 0;
    return 0.5 * (score(gl, hl) + score(gr, hr) - score(gl + gr, hl + hr)) - gamma;
}

/** Weighted binary CART or a Newton tree; global cuts restrict histogram candidates. */
export function fitTree(samples: readonly TreeSample[], options: TreeOptions = {}): TreeNode {
    if (!samples.length || !samples[0].x.length) throw new RangeError('Supply nonempty samples and features.');
    const dimensions = samples[0].x.length;
    if (samples.some(row => row.x.length !== dimensions || !Number.isFinite(row.y) || row.x.some(x => !Number.isFinite(x)))) {
        throw new RangeError('Tree samples must be finite and have consistent dimensions.');
    }
    const task = options.task ?? 'regression';
    const weights = options.weights ?? samples.map(() => 1);
    if (weights.length !== samples.length || weights.some(w => !Number.isFinite(w) || w < 0) || sum(weights) <= 0) {
        throw new RangeError('Weights must be finite, nonnegative, and have positive total mass.');
    }
    const maxDepth = options.maxDepth ?? 3;
    const minLeaf = options.minLeaf ?? 2;
    const maxLeaves = options.maxLeaves ?? 2 ** maxDepth;
    const random = seededRandom(options.seed ?? 1);
    const totalWeight = sum(weights);
    let nextId = 0;
    const newton = options.newton;
    const makeNode = (indices: number[], depth: number): TreeNode => {
        const mass = sum(indices.map(i => weights[i]));
        const mean = sum(indices.map(i => weights[i] * samples[i].y)) / mass;
        const risk = task === 'classification' ? mass * 2 * mean * (1 - mean)
            : sum(indices.map(i => weights[i] * (samples[i].y - mean) ** 2));
        const gradient = newton ? sum(indices.map(i => weights[i] * newton.gradients[i])) : undefined;
        const hessian = newton ? sum(indices.map(i => weights[i] * newton.hessians[i])) : undefined;
        return { id: nextId++, depth, indices, value: newton ? -(gradient ?? 0) / ((hessian ?? 0) + newton.lambda || 1) : mean,
            risk, gradient, hessian };
    };
    const cuts = Array.from({ length: dimensions }, (_, feature) => options.bins
        ? histogramCuts(samples.map(row => row.x[feature]), options.bins) : undefined);
    const bestSplit = (node: TreeNode): Split | undefined => {
        if (node.depth >= maxDepth || node.indices.length < 2 * minLeaf) return undefined;
        const features = Array.from({ length: dimensions }, (_, i) => i);
        for (let i = features.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [features[i], features[j]] = [features[j], features[i]];
        }
        let best: Split | undefined;
        for (const feature of features.slice(0, options.maxFeatures ?? dimensions)) {
            const histogramThresholds = cuts[feature];
            if (histogramThresholds) {
                // Aggregate once into global bins, then evaluate cumulative statistics.
                const histogram = Array.from({ length: histogramThresholds.length + 1 }, () => ({ count: 0, mass: 0, y: 0, y2: 0, g: 0, h: 0 }));
                for (const index of node.indices) {
                    let bin = 0;
                    while (bin < histogramThresholds.length && samples[index].x[feature] > histogramThresholds[bin]) bin++;
                    const bucket = histogram[bin]; const weight = weights[index];
                    bucket.count++; bucket.mass += weight; bucket.y += weight * samples[index].y; bucket.y2 += weight * samples[index].y ** 2;
                    bucket.g += newton ? weight * newton.gradients[index] : 0;
                    bucket.h += newton ? weight * newton.hessians[index] : 0;
                }
                const total = histogram.reduce((a, b) => ({ count: a.count + b.count, mass: a.mass + b.mass,
                    y: a.y + b.y, y2: a.y2 + b.y2, g: a.g + b.g, h: a.h + b.h }));
                const left = { count: 0, mass: 0, y: 0, y2: 0, g: 0, h: 0 };
                const risk = (mass: number, y: number, y2: number) => task === 'classification'
                    ? 2 * y * (1 - y / mass) : Math.max(0, y2 - y * y / mass);
                for (let bin = 0; bin < histogramThresholds.length; bin++) {
                    const bucket = histogram[bin];
                    left.count += bucket.count; left.mass += bucket.mass; left.y += bucket.y; left.y2 += bucket.y2; left.g += bucket.g; left.h += bucket.h;
                    if (left.count < minLeaf || total.count - left.count < minLeaf) continue;
                    const gain = newton ? newtonSplitGain(left.g, left.h, total.g - left.g, total.h - left.h, newton.lambda, newton.gamma)
                        : node.risk - risk(left.mass, left.y, left.y2) - risk(total.mass - left.mass, total.y - left.y, total.y2 - left.y2);
                    if (gain > 1e-10 && (!best || gain > best.gain + 1e-10)) {
                        const threshold = histogramThresholds[bin];
                        best = { feature, threshold, gain, left: node.indices.filter(i => samples[i].x[feature] <= threshold),
                            right: node.indices.filter(i => samples[i].x[feature] > threshold) };
                    }
                }
                continue;
            }
            const unique = [...new Set(node.indices.map(i => samples[i].x[feature]))].sort((a, b) => a - b);
            const thresholds = unique.slice(1).map((value, i) => (value + unique[i]) / 2);
            for (const threshold of thresholds) {
                const left = node.indices.filter(i => samples[i].x[feature] <= threshold);
                const right = node.indices.filter(i => samples[i].x[feature] > threshold);
                if (left.length < minLeaf || right.length < minLeaf) continue;
                const stats = (indices: number[]) => {
                    const mass = sum(indices.map(i => weights[i]));
                    const mean = sum(indices.map(i => weights[i] * samples[i].y)) / mass;
                    const risk = task === 'classification' ? mass * 2 * mean * (1 - mean)
                        : sum(indices.map(i => weights[i] * (samples[i].y - mean) ** 2));
                    return { risk, g: newton ? sum(indices.map(i => weights[i] * newton.gradients[i])) : 0,
                        h: newton ? sum(indices.map(i => weights[i] * newton.hessians[i])) : 0 };
                };
                const l = stats(left); const r = stats(right);
                const gain = newton ? newtonSplitGain(l.g, l.h, r.g, r.h, newton.lambda, newton.gamma) : node.risk - l.risk - r.risk;
                if (gain > 1e-10 && (!best || gain > best.gain + 1e-10)) best = { feature, threshold, gain, left, right };
            }
        }
        return best;
    };
    const root = makeNode(samples.map((_, i) => i).filter(i => weights[i] > 0), 0);
    const candidates = new Map<TreeNode, Split | undefined>([[root, bestSplit(root)]]);
    let leafCount = 1;
    while (leafCount < maxLeaves) {
        const eligible = [...candidates.entries()].filter((entry): entry is [TreeNode, Split] => entry[1] !== undefined);
        if (!eligible.length) break;
        eligible.sort((a, b) => options.growth === 'leafwise' ? b[1].gain - a[1].gain
            : a[0].depth - b[0].depth || a[0].id - b[0].id);
        const [node, split] = eligible[0];
        node.feature = split.feature; node.threshold = split.threshold; node.gain = split.gain;
        node.left = makeNode(split.left, node.depth + 1); node.right = makeNode(split.right, node.depth + 1);
        candidates.delete(node);
        candidates.set(node.left, bestSplit(node.left)); candidates.set(node.right, bestSplit(node.right));
        leafCount++;
    }
    const alpha = options.pruning ?? 0;
    const prune = (node: TreeNode): { risk: number; leaves: number } => {
        if (!node.left || !node.right) return { risk: node.risk / totalWeight, leaves: 1 };
        const l = prune(node.left); const r = prune(node.right);
        if (alpha > 0 && node.risk / totalWeight + alpha <= l.risk + r.risk + alpha * (l.leaves + r.leaves)) {
            delete node.left; delete node.right; delete node.feature; delete node.threshold; delete node.gain;
            return { risk: node.risk / totalWeight, leaves: 1 };
        }
        return { risk: l.risk + r.risk, leaves: l.leaves + r.leaves };
    };
    if (!newton) prune(root);
    return root;
}

export function treePath(tree: TreeNode, x: readonly number[]): TreeNode[] {
    const path = [tree];
    let node = tree;
    while (node.left && node.right && node.feature !== undefined && node.threshold !== undefined) {
        node = x[node.feature] <= node.threshold ? node.left : node.right;
        path.push(node);
    }
    return path;
}
export const predictTree = (tree: TreeNode, x: readonly number[]) => treePath(tree, x).at(-1)?.value ?? tree.value;
export function treeLeaves(tree: TreeNode): TreeNode[] { return tree.left && tree.right ? [...treeLeaves(tree.left), ...treeLeaves(tree.right)] : [tree]; }

export interface BaggedTree { tree: TreeNode; inBag: number[] }
export function fitBagging(samples: readonly TreeSample[], rounds: number, options: TreeOptions = {}): BaggedTree[] {
    const random = seededRandom(options.seed ?? 1);
    return Array.from({ length: rounds }, (_, round) => {
        const inBag = samples.map(() => 0);
        const bootstrap = samples.map(() => {
            const index = Math.floor(random() * samples.length); inBag[index]++;
            return samples[index];
        });
        return { tree: fitTree(bootstrap, { ...options, seed: (options.seed ?? 1) + round * 97 }), inBag };
    });
}
export function predictBagging(trees: readonly BaggedTree[], x: readonly number[]): number {
    return trees.length ? sum(trees.map(({ tree }) => predictTree(tree, x))) / trees.length : 0;
}
export function outOfBagPredictions(trees: readonly BaggedTree[], samples: readonly TreeSample[]): Array<number | null> {
    return samples.map((row, i) => {
        const eligible = trees.filter(tree => tree.inBag[i] === 0);
        return eligible.length ? predictBagging(eligible, row.x) : null;
    });
}

export interface GossSample { weights: number[]; kept: number[]; large: number[]; small: number[]; correction: number }
/** Keep top a proportion and sample b of ALL rows from the remaining population. */
export function gossSample(gradients: readonly number[], topRate: number, otherRate: number, seed: number): GossSample {
    if (topRate <= 0 || otherRate <= 0 || topRate + otherRate > 1) throw new RangeError('GOSS rates must be positive and sum to at most one.');
    const ranked = gradients.map((_, i) => i).sort((a, b) => Math.abs(gradients[b]) - Math.abs(gradients[a]) || a - b);
    const topCount = Math.min(ranked.length, Math.max(1, Math.floor(topRate * ranked.length)));
    const large = ranked.slice(0, topCount); const rest = ranked.slice(topCount);
    const random = seededRandom(seed);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const small = rest.slice(0, Math.min(rest.length, Math.max(1, Math.floor(otherRate * ranked.length))));
    const correction = small.length ? rest.length / small.length : 1;
    const weights = gradients.map(() => 0);
    large.forEach(i => { weights[i] = 1; }); small.forEach(i => { weights[i] = correction; });
    return { weights, kept: [...large, ...small], large, small, correction };
}

export type BoostAlgorithm = 'gradient' | 'adaboost' | 'xgboost' | 'lightgbm';
export interface BoostRound {
    tree: TreeNode; predictions: number[]; gradients: number[]; hessians: number[];
    weights: number[]; nextWeights?: number[]; alpha: number; loss: number; sampling?: GossSample;
}
export interface BoostModel { base: number; rounds: BoostRound[]; algorithm: BoostAlgorithm; task: TreeTask; learningRate: number }
export interface BoostOptions extends TreeOptions { algorithm: BoostAlgorithm; rounds: number; learningRate?: number; lambda?: number; gamma?: number; goss?: boolean }

export function predictionLoss(samples: readonly TreeSample[], predictions: readonly number[], task: TreeTask): number {
    return sum(samples.map((row, i) => task === 'regression' ? (row.y - predictions[i]) ** 2
        : -row.y * Math.log(Math.max(1e-12, predictions[i])) - (1 - row.y) * Math.log(Math.max(1e-12, 1 - predictions[i])))) / samples.length;
}
export function fitBoosting(samples: readonly TreeSample[], options: BoostOptions): BoostModel {
    const task = options.algorithm === 'adaboost' ? 'classification' : options.task ?? 'regression';
    const mean = sum(samples.map(row => row.y)) / samples.length;
    const base = options.algorithm === 'adaboost' ? 0 : task === 'classification'
        ? Math.log(Math.max(1e-6, mean) / Math.max(1e-6, 1 - mean)) : mean;
    const learningRate = options.learningRate ?? 0.3;
    const model: BoostModel = { base, rounds: [], algorithm: options.algorithm, task, learningRate };
    const scores = samples.map(() => base);
    let weights = samples.map(() => 1 / samples.length);
    for (let round = 0; round < options.rounds; round++) {
        const before = scores.map(score => task === 'classification' ? treeSigmoid(score) : score);
        const gradients = samples.map((row, i) => before[i] - row.y);
        const hessians = samples.map((_, i) => task === 'classification' ? Math.max(1e-8, before[i] * (1 - before[i])) : 1);
        let tree: TreeNode; let alpha = learningRate; let sampling: GossSample | undefined; let nextWeights: number[] | undefined;
        let perfectWeakLearner = false;
        if (options.algorithm === 'adaboost') {
            tree = fitTree(samples, { task, maxDepth: 1, minLeaf: 1, weights, seed: round + 1 });
            const signed = samples.map(row => predictTree(tree, row.x) >= 0.5 ? 1 : -1);
            const error = sum(samples.map((row, i) => signed[i] === (row.y ? 1 : -1) ? 0 : weights[i]));
            if (error >= 0.5 - 1e-10) break;
            perfectWeakLearner = error <= 1e-12;
            alpha = learningRate * 0.5 * Math.log((1 - Math.max(error, 1e-12)) / Math.max(error, 1e-12));
            const adjusted = samples.map((row, i) => weights[i] * Math.exp(-alpha * (row.y ? 1 : -1) * signed[i]));
            const normalization = sum(adjusted); nextWeights = adjusted.map(weight => weight / normalization);
            scores.forEach((_, i) => { scores[i] += alpha * signed[i]; });
        } else {
            const newton = options.algorithm === 'xgboost' || options.algorithm === 'lightgbm';
            sampling = options.algorithm === 'lightgbm' && options.goss ? gossSample(gradients, 0.25, 0.25, (options.seed ?? 1) + round) : undefined;
            const trainingTargets = samples.map((row, i) => ({ x: row.x, y: -gradients[i] }));
            tree = fitTree(trainingTargets, { ...options, task: 'regression', seed: (options.seed ?? 1) + round,
                growth: options.algorithm === 'lightgbm' ? 'leafwise' : options.growth,
                bins: options.algorithm === 'lightgbm' ? options.bins ?? 8 : undefined,
                weights: sampling?.weights,
                newton: newton ? { gradients, hessians, lambda: options.lambda ?? 1, gamma: options.gamma ?? 0 } : undefined });
            scores.forEach((_, i) => { scores[i] += alpha * predictTree(tree, samples[i].x); });
        }
        const predictions = scores.map(score => task === 'classification' ? treeSigmoid(options.algorithm === 'adaboost' ? 2 * score : score) : score);
        model.rounds.push({ tree, predictions, gradients, hessians, weights: [...weights], nextWeights, alpha,
            loss: predictionLoss(samples, predictions, task), sampling });
        if (nextWeights) weights = nextWeights;
        if (perfectWeakLearner) break;
    }
    return model;
}
export function predictBoosting(model: BoostModel, x: readonly number[], rounds = model.rounds.length): number {
    let score = model.base;
    for (const round of model.rounds.slice(0, rounds)) {
        score += round.alpha * (model.algorithm === 'adaboost' ? predictTree(round.tree, x) >= 0.5 ? 1 : -1 : predictTree(round.tree, x));
    }
    return model.task === 'classification' ? treeSigmoid(model.algorithm === 'adaboost' ? 2 * score : score) : score;
}

/** Exact bundling of two mutually-exclusive binary indicator columns; collisions are rejected. */
export function bundleExclusiveIndicators(rows: readonly number[][]): number[] {
    return rows.map(row => {
        if (row.length !== 2 || row.some(value => value !== 0 && value !== 1) || row[0] + row[1] > 1) {
            throw new RangeError('Bundling requires mutually exclusive binary indicators.');
        }
        return row[0] ? 1 : row[1] ? 2 : 0;
    });
}
export function decodeExclusiveIndicators(bundle: readonly number[]): number[][] {
    return bundle.map(value => {
        if (value !== 0 && value !== 1 && value !== 2) throw new RangeError('Invalid exclusive bundle code.');
        return [value === 1 ? 1 : 0, value === 2 ? 1 : 0];
    });
}

export function treeData(task: TreeTask, count: number, noise: number, seed: number, dimensions: 2 | 3 = 2): TreeSample[] {
    const random = seededRandom(seed);
    return Array.from({ length: count }, () => {
        const x = [random() * 2 - 1, random() * 2 - 1];
        if (dimensions === 3) x.push(random() * 2 - 1);
        const signal = 0.8 * Math.sin(Math.PI * x[0]) + 0.5 * x[1] ** 2 + (x[0] > 0.25 && x[1] > 0 ? 0.5 : 0) + (dimensions === 3 ? 1.2 * x[2] + 0.3 * x[0] * x[2] : 0);
        const standardNoise = sampleNormal(random);
        const target = task === 'classification' ? (signal + noise * standardNoise > 0.2 ? 1 : 0) : signal + noise * standardNoise;
        return { x, y: target };
    });
}
