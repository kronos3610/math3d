import { describe, expect, test } from 'vitest';
import { bundleExclusiveIndicators, decodeExclusiveIndicators, fitBagging, fitBoosting, fitTree, gossSample,
    histogramCuts, newtonSplitGain, outOfBagPredictions, predictBagging, predictBoosting, predictionLoss,
    predictTree, treeData, treeLeaves, treePath, treeSigmoid } from './ml-trees';
import type { TreeNode, TreeSample } from './ml-trees';

const rows = (targets: number[]): TreeSample[] => targets.map((y, index) => ({ x: [index], y }));
const nodes = (tree: TreeNode): TreeNode[] => [tree, ...(tree.left ? nodes(tree.left) : []), ...(tree.right ? nodes(tree.right) : [])];

describe('weighted CART and tree growth', () => {
    test('classification finds the Gini-reducing threshold and exact query path', () => {
        const samples = rows([0, 0, 1, 1]);
        const tree = fitTree(samples, { task: 'classification', maxDepth: 2, minLeaf: 1 });
        expect(tree.threshold).toBe(1.5);
        expect(tree.risk).toBe(2);
        expect(tree.gain).toBe(2);
        expect(treeLeaves(tree).map(leaf => leaf.value)).toEqual([0, 1]);
        expect(treePath(tree, [1.5]).map(node => node.id)).toEqual([tree.id, tree.left?.id]);
        expect(predictTree(tree, [1.50001])).toBe(1);
    });

    test('regression minimizes SSE and predicts response means; depth and leaf limits constrain it', () => {
        const samples = rows([0, 2, 8, 10]);
        const tree = fitTree(samples, { maxDepth: 1, minLeaf: 1 });
        expect(tree.value).toBe(5);
        expect(tree.risk).toBe(68);
        expect(tree.gain).toBe(64);
        expect(tree.threshold).toBe(1.5);
        expect(treeLeaves(tree).map(leaf => leaf.value)).toEqual([1, 9]);
        expect(predictTree(fitTree(samples, { maxDepth: 0 }), [0])).toBe(5);
        expect(treeLeaves(fitTree(samples, { minLeaf: 3 }))).toHaveLength(1);
        expect(treeLeaves(fitTree(samples, { maxDepth: 3, minLeaf: 1 }))).toHaveLength(4);
    });

    test('a weighted leaf uses mass rather than row count and leaves input samples untouched', () => {
        const samples = rows([0, 1]);
        const original = structuredClone(samples);
        const tree = fitTree(samples, { task: 'classification', maxDepth: 0, weights: [9, 1] });
        expect(tree.value).toBeCloseTo(0.1, 12);
        expect(tree.risk).toBeCloseTo(1.8, 12);
        expect(samples).toEqual(original);
    });

    test('cost-complexity pruning compares normalized risk plus alpha per leaf', () => {
        const samples = rows([0, 2, 8, 10]);
        expect(treeLeaves(fitTree(samples, { maxDepth: 1, minLeaf: 1, pruning: 15 }))).toHaveLength(2);
        const pruned = fitTree(samples, { maxDepth: 1, minLeaf: 1, pruning: 17 });
        expect(treeLeaves(pruned)).toHaveLength(1);
        expect(pruned.feature).toBeUndefined();
        expect(pruned.value).toBe(5);
    });

    test('largest-gain growth spends a restricted leaf budget on the more useful branch', () => {
        const samples = rows([0, 0, 1, 1, 10, 10, 14, 14]);
        const depth = fitTree(samples, { minLeaf: 1, maxDepth: 3, maxLeaves: 3, growth: 'depthwise' });
        const leaf = fitTree(samples, { minLeaf: 1, maxDepth: 3, maxLeaves: 3, growth: 'leafwise' });
        expect(depth.threshold).toBe(3.5);
        expect(leaf.threshold).toBe(3.5);
        expect(depth.left?.left).toBeDefined();
        expect(depth.right?.left).toBeUndefined();
        expect(leaf.left?.left).toBeUndefined();
        expect(leaf.right?.left).toBeDefined();
        expect(predictionLoss(samples, samples.map(row => predictTree(leaf, row.x)), 'regression'))
            .toBeLessThan(predictionLoss(samples, samples.map(row => predictTree(depth, row.x)), 'regression'));
    });

    test('per-node random feature selection is repeatable and can choose either feature', () => {
        const samples = rows([0, 0, 1, 1]).map(row => ({ ...row, x: [row.x[0], row.x[0]] }));
        const options = { task: 'classification' as const, maxFeatures: 1, minLeaf: 1, seed: 31 };
        expect(fitTree(samples, options)).toEqual(fitTree(samples, options));
        const selected = new Set(Array.from({ length: 30 }, (_, seed) => fitTree(samples, { ...options, seed }).feature));
        expect(selected).toEqual(new Set([0, 1]));
    });

    test('histogram aggregation uses quantile cuts and agrees with exact statistics at full resolution', () => {
        const samples = rows([0, 0, 10, 10, 10, 10, 10, 10]);
        expect(histogramCuts(samples.map(row => row.x[0]), 2)).toEqual([3.5]);
        const coarse = fitTree(samples, { minLeaf: 1, bins: 2, maxDepth: 1 });
        const exact = fitTree(samples, { minLeaf: 1, maxDepth: 1 });
        expect(coarse.threshold).toBe(3.5);
        expect(coarse.gain).toBe(50);
        expect(treeLeaves(coarse).map(leaf => leaf.value)).toEqual([5, 10]);
        expect(exact.threshold).toBe(1.5);
        expect(exact.gain).toBe(150);
        const weightedOptions = { minLeaf: 1, maxDepth: 3, weights: [1, 4, 2, 1, 3, 2, 5, 1] };
        expect(fitTree(samples, { ...weightedOptions, bins: 8 })).toEqual(fitTree(samples, weightedOptions));
    });

    test('invalid sample dimensions and weights are rejected instead of fitting NaN models', () => {
        expect(() => fitTree([])).toThrow(RangeError);
        expect(() => fitTree([{ x: [0], y: 0 }, { x: [1, 2], y: 1 }])).toThrow(RangeError);
        expect(() => fitTree(rows([0, 1]), { weights: [0, 0] })).toThrow(RangeError);
        expect(() => fitTree(rows([0, 1]), { weights: [1, -1] })).toThrow(RangeError);
    });
});

describe('bootstrap bagging and genuine out-of-bag predictions', () => {
    test('bootstrap draws repeat rows and constant trees equal their actual bootstrap means', () => {
        const samples = rows([0, 2, 4, 8, 10, 20]);
        const forest = fitBagging(samples, 20, { seed: 777, maxDepth: 0 });
        expect(forest).toEqual(fitBagging(samples, 20, { seed: 777, maxDepth: 0 }));
        for (const entry of forest) {
            expect(entry.inBag.reduce((a, b) => a + b, 0)).toBe(samples.length);
            const mean = entry.inBag.reduce((total, count, i) => total + count * samples[i].y, 0) / samples.length;
            expect(predictTree(entry.tree, [0])).toBeCloseTo(mean, 12);
        }
        expect(forest.some(entry => entry.inBag.some(count => count > 1))).toBe(true);
        expect(predictBagging(forest, [0])).toBeCloseTo(forest.reduce((total, entry) => total + entry.tree.value, 0) / 20, 12);
    });

    test('OOB means use only omitted-row trees and missing coverage remains null', () => {
        const samples = rows([0, 2, 4, 8, 10, 20]);
        const forest = fitBagging(samples, 8, { seed: 777, maxDepth: 0 });
        const predictions = outOfBagPredictions(forest, samples);
        for (let i = 0; i < samples.length; i++) {
            const eligible = forest.filter(entry => entry.inBag[i] === 0);
            const independentMeans = eligible.map(entry => entry.inBag.reduce((total, count, j) => total + count * samples[j].y, 0) / samples.length);
            if (eligible.length) expect(predictions[i]).toBeCloseTo(independentMeans.reduce((a, b) => a + b, 0) / eligible.length, 12);
            else expect(predictions[i]).toBeNull();
        }
        expect(outOfBagPredictions([], samples)).toEqual(samples.map(() => null));
        expect(outOfBagPredictions(forest.slice(0, 1), samples).filter(value => value === null).length).toBeGreaterThan(0);
    });
});

describe('actual additive boosting and Newton mathematics', () => {
    test('residual boosting updates the constant prediction and losses at each round', () => {
        const samples = rows([0, 0, 2, 2]);
        const model = fitBoosting(samples, { algorithm: 'gradient', rounds: 2, learningRate: 0.5, maxDepth: 1, minLeaf: 1 });
        expect(model.base).toBe(1);
        expect(model.rounds[0].gradients).toEqual([1, 1, -1, -1]);
        expect(model.rounds[0].predictions).toEqual([0.5, 0.5, 1.5, 1.5]);
        expect(model.rounds[0].loss).toBe(0.25);
        expect(model.rounds[1].predictions).toEqual([0.25, 0.25, 1.75, 1.75]);
        expect(model.rounds[1].loss).toBe(0.0625);
        expect(predictBoosting(model, [0], 0)).toBe(1);
        expect(predictBoosting(model, [0], 1)).toBe(0.5);
        expect(predictBoosting(model, [0], 2)).toBe(0.25);
    });

    test('classification uses cross-entropy gradients and Hessians, with sigmoid score updates', () => {
        const samples = rows([0, 0, 1, 1]);
        const model = fitBoosting(samples, { algorithm: 'xgboost', task: 'classification', rounds: 1, learningRate: 0.5, lambda: 0, gamma: 0, minLeaf: 1, maxDepth: 1 });
        expect(model.base).toBe(0);
        expect(model.rounds[0].gradients).toEqual([0.5, 0.5, -0.5, -0.5]);
        expect(model.rounds[0].hessians).toEqual([0.25, 0.25, 0.25, 0.25]);
        expect(treeLeaves(model.rounds[0].tree).map(leaf => leaf.value)).toEqual([-2, 2]);
        expect(predictBoosting(model, [0])).toBeCloseTo(1 / (1 + Math.exp(1)), 12);
        expect(predictBoosting(model, [3])).toBeCloseTo(1 / (1 + Math.exp(-1)), 12);
    });

    test('Newton split gain, lambda shrinkage, and gamma threshold agree with hand calculations', () => {
        const samples = rows([0, 0, 0, 0]);
        const newton = { gradients: [-2, -2, 2, 2], hessians: [1, 1, 1, 1], lambda: 1, gamma: 1 };
        expect(newtonSplitGain(-4, 2, 4, 2, 1, 1)).toBeCloseTo(13 / 3, 12);
        const tree = fitTree(samples, { minLeaf: 1, maxDepth: 1, newton });
        expect(tree.value).toBeCloseTo(0, 12);
        expect(tree.gain).toBeCloseTo(13 / 3, 12);
        expect(tree.left?.gradient).toBe(-4);
        expect(tree.left?.hessian).toBe(2);
        expect(tree.left?.value).toBeCloseTo(4 / 3, 12);
        expect(tree.right?.value).toBeCloseTo(-4 / 3, 12);
        expect(treeLeaves(fitTree(samples, { minLeaf: 1, newton: { ...newton, gamma: 10 } }))).toHaveLength(1);
        const shrink = fitTree(samples, { minLeaf: 1, maxDepth: 1, newton: { ...newton, lambda: 3, gamma: 0 } });
        expect(shrink.left?.value).toBeCloseTo(0.8, 12);
        expect(fitTree(samples, { minLeaf: 1, maxDepth: 1, bins: 4, newton })).toEqual(tree);
    });

    test('lambda regularizes actual additive regression updates', () => {
        const samples = rows([0, 0, 2, 2]);
        const model = fitBoosting(samples, { algorithm: 'xgboost', rounds: 1, lambda: 2, gamma: 0, learningRate: 0.5, maxDepth: 1, minLeaf: 1 });
        expect(treeLeaves(model.rounds[0].tree).map(leaf => leaf.value)).toEqual([-0.5, 0.5]);
        expect(model.rounds[0].predictions).toEqual([0.75, 0.75, 1.25, 1.25]);
        expect(model.rounds[0].loss).toBe(0.5625);
    });

    test('AdaBoost computes weighted weak error and increases misclassified relative weight', () => {
        const samples = rows([0, 0, 1, 0]);
        const model = fitBoosting(samples, { algorithm: 'adaboost', rounds: 1, learningRate: 1 });
        const round = model.rounds[0];
        expect(round.tree.threshold).toBe(1.5);
        expect(round.alpha).toBeCloseTo(0.5 * Math.log(3), 12);
        expect(round.weights).toEqual([0.25, 0.25, 0.25, 0.25]);
        expect(round.nextWeights?.[3]).toBeCloseTo(0.5, 12);
        for (const index of [0, 1, 2]) expect(round.nextWeights?.[index]).toBeCloseTo(1 / 6, 12);
        expect(round.nextWeights?.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 12);
        expect(predictBoosting(model, [0])).toBeCloseTo(0.25, 12);
        expect(predictBoosting(model, [3])).toBeCloseTo(0.75, 12);
    });

    test('AdaBoost stops at a perfect weak learner or a learner no better than chance', () => {
        const perfect = fitBoosting(rows([0, 0, 1, 1]), { algorithm: 'adaboost', rounds: 10, learningRate: 1 });
        expect(perfect.rounds).toHaveLength(1);
        expect(predictBoosting(perfect, [0])).toBeLessThan(1e-10);
        expect(predictBoosting(perfect, [3])).toBeGreaterThan(1 - 1e-10);
        const chance = fitBoosting([{ x: [0], y: 0 }, { x: [0], y: 1 }], { algorithm: 'adaboost', rounds: 10 });
        expect(chance.rounds).toHaveLength(0);
        expect(predictBoosting(chance, [0])).toBe(0.5);
    });

    test('LightGBM uses bounded histogram candidates and a real additive loss trace', () => {
        const samples = treeData('regression', 32, 0.1, 42);
        const options = { algorithm: 'lightgbm' as const, rounds: 3, learningRate: 0.3, maxDepth: 4, maxLeaves: 5, minLeaf: 1, bins: 3, lambda: 1, gamma: 0, seed: 13 };
        const model = fitBoosting(samples, options);
        const cuts = [0, 1].map(feature => histogramCuts(samples.map(row => row.x[feature]), 3));
        for (const [index, round] of model.rounds.entries()) {
            expect(treeLeaves(round.tree).length).toBeLessThanOrEqual(5);
            for (const node of nodes(round.tree)) if (node.feature !== undefined) expect(cuts[node.feature]).toContain(node.threshold);
            const independent = samples.map(row => model.base + model.rounds.slice(0, index + 1).reduce((score, update) => score + options.learningRate * predictTree(update.tree, row.x), 0));
            for (const [i, prediction] of round.predictions.entries()) expect(prediction).toBeCloseTo(independent[i], 12);
            expect(round.loss).toBeCloseTo(independent.reduce((total, prediction, i) => total + (prediction - samples[i].y) ** 2, 0) / samples.length, 12);
        }
        expect(model).toEqual(fitBoosting(samples, options));
    });

    test('sigmoid remains finite at extreme logits', () => {
        expect(treeSigmoid(-1000)).toBe(0);
        expect(treeSigmoid(1000)).toBe(1);
        expect(treeSigmoid(0)).toBe(0.5);
    });
});

describe('gradient sampling, exclusive packing, and repeatable data', () => {
    test('GOSS retains the largest gradients and corrects sampled small-gradient mass', () => {
        const gradients = [1, 1, 1, 1, 1, 1, 10, 20];
        const sampling = gossSample(gradients, 0.25, 0.25, 11);
        expect(sampling.large).toEqual([7, 6]);
        expect(sampling.small).toHaveLength(2);
        expect(sampling.kept).toHaveLength(4);
        expect(sampling.correction).toBe(3);
        expect(sampling.weights.reduce((a, b) => a + b, 0)).toBe(8);
        expect(sampling.weights.reduce((total, weight, i) => total + weight * gradients[i], 0)).toBe(36);
        expect(sampling).toEqual(gossSample(gradients, 0.25, 0.25, 11));
        const tree = fitTree(rows(gradients), { maxDepth: 0, weights: sampling.weights,
            newton: { gradients, hessians: gradients.map(() => 1), lambda: 1, gamma: 0 } });
        expect(tree.indices).toHaveLength(4);
        expect(tree.gradient).toBe(36);
        expect(tree.hessian).toBe(8);
        expect(tree.value).toBe(-4);
        expect(() => gossSample(gradients, 0.8, 0.5, 1)).toThrow(RangeError);
    });

    test('LightGBM GOSS changes the fitted rows and uses their corrected gradient/Hessian sums', () => {
        const samples = treeData('regression', 48, 0.15, 3610);
        const model = fitBoosting(samples, { algorithm: 'lightgbm', rounds: 2, bins: 5, goss: true, seed: 19, maxLeaves: 5 });
        for (const round of model.rounds) {
            const sampling = round.sampling!;
            expect(sampling.kept).toHaveLength(24);
            expect(sampling.correction).toBe(3);
            expect(round.tree.indices.slice().sort((a, b) => a - b)).toEqual(sampling.kept.slice().sort((a, b) => a - b));
            expect(round.tree.gradient).toBeCloseTo(sampling.weights.reduce((total, weight, i) => total + weight * round.gradients[i], 0), 12);
            expect(round.tree.hessian).toBe(48);
        }
    });

    test('exclusive feature bundling is lossless and rejects collisions instead of hiding them', () => {
        const indicators = [[0, 0], [1, 0], [0, 1], [1, 0], [0, 0]];
        expect(bundleExclusiveIndicators(indicators)).toEqual([0, 1, 2, 1, 0]);
        expect(decodeExclusiveIndicators(bundleExclusiveIndicators(indicators))).toEqual(indicators);
        expect(() => bundleExclusiveIndicators([[1, 1]])).toThrow(RangeError);
        expect(() => bundleExclusiveIndicators([[0.5, 0]])).toThrow(RangeError);
        expect(() => decodeExclusiveIndicators([3])).toThrow(RangeError);
    });

    test('data resampling is deterministic, independent streams differ, and noise scales an actual draw', () => {
        const clean = treeData('regression', 12, 0, 42);
        const noisy = treeData('regression', 12, 0.2, 42);
        const twiceNoise = treeData('regression', 12, 0.4, 42);
        expect(noisy).toEqual(treeData('regression', 12, 0.2, 42));
        expect(noisy).not.toEqual(treeData('regression', 12, 0.2, 100042));
        for (let i = 0; i < clean.length; i++) {
            expect(noisy[i].x).toEqual(clean[i].x);
            expect(twiceNoise[i].y - clean[i].y).toBeCloseTo(2 * (noisy[i].y - clean[i].y), 12);
        }
        expect(treeData('classification', 12, 0.2, 42).every(row => row.y === 0 || row.y === 1)).toBe(true);
    });
});
