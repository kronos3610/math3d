import { describe, expect, test } from 'vitest';
import {
    classificationRegion, decisionBoundary, exampleClassificationPoints, fitLinearClassifier,
    linearScore, predictClass, sigmoid,
} from './linear-models';
import type { ClassificationPoint, LinearWeights, PlotPoint } from './linear-models';

describe('linear classifier mathematics and plotting', () => {
    test.each(['logistic', 'least-squares', 'perceptron'] as const)('%s fits the separated example without mutating its data', algorithm => {
        const points = exampleClassificationPoints(3610);
        const original = structuredClone(points);
        const fit = fitLinearClassifier(points, algorithm);
        expect(fit.converged).toBe(true);
        expect(fit.weights.every(Number.isFinite)).toBe(true);
        expect(points.every(point => predictClass(fit.weights, algorithm, point) === point.target)).toBe(true);
        expect(points).toEqual(original);
    });

    test('least squares predicts unrestricted numeric values and applies a 0.5 classification threshold', () => {
        const points: ClassificationPoint[] = [{ x1: -0.2, x2: 0, target: 0 }, { x1: 0.2, x2: 0, target: 1 }];
        const fit = fitLinearClassifier(points, 'least-squares');
        expect(linearScore(fit.weights, { x1: 1, x2: 0 })).toBeGreaterThan(1);
        expect(linearScore(fit.weights, { x1: -1, x2: 0 })).toBeLessThan(0);
        expect(predictClass([0.25, 0, 0], 'least-squares', { x1: 0, x2: 0 })).toBe(0);
        expect(predictClass([0.25, 0, 0], 'logistic', { x1: 0, x2: 0 })).toBe(1);
        expect(predictClass([0.5, 0, 0], 'least-squares', { x1: 0, x2: 0 })).toBe(1);
    });

    test('logistic fit reaches a stationary point of penalized binary cross-entropy', () => {
        const points = exampleClassificationPoints(22);
        const { weights, converged } = fitLinearClassifier(points, 'logistic');
        const objective = (candidate: LinearWeights) => points.reduce((sum, point) => {
            const probability = sigmoid(linearScore(candidate, point));
            return sum - point.target * Math.log(probability) - (1 - point.target) * Math.log(1 - probability);
        }, 0) + 0.0005 * candidate[0] ** 2 + 0.025 * (candidate[1] ** 2 + candidate[2] ** 2);
        expect(converged).toBe(true);
        expect(objective(weights)).toBeLessThan(objective([0, 0, 0]));
        for (let index = 0; index < 3; index++) {
            const plus: LinearWeights = [...weights];
            const minus: LinearWeights = [...weights];
            plus[index] += 1e-5;
            minus[index] -= 1e-5;
            expect(Math.abs((objective(plus) - objective(minus)) / 2e-5)).toBeLessThan(1e-5);
        }
        expect(sigmoid(-1000)).toBe(0);
        expect(sigmoid(1000)).toBe(1);
    });

    test('conflicting labels report perceptron nonconvergence, while logistic remains finite', () => {
        const points: ClassificationPoint[] = [{ x1: 0, x2: 0, target: 0 }, { x1: 0, x2: 0, target: 1 }];
        expect(fitLinearClassifier(points, 'perceptron')).toMatchObject({ converged: false, iterations: 1000 });
        const logistic = fitLinearClassifier(points, 'logistic');
        expect(logistic.converged).toBe(true);
        expect(sigmoid(linearScore(logistic.weights, points[0]))).toBeCloseTo(0.5, 12);
    });

    test('clips vertical and horizontal boundaries without dividing by a zero coefficient', () => {
        expect(decisionBoundary([0, 1, 0], 'logistic')).toEqual([{ x1: 0, x2: -1 }, { x1: 0, x2: 1 }]);
        expect(decisionBoundary([0, 1, 0], 'least-squares')).toEqual([{ x1: 0.5, x2: -1 }, { x1: 0.5, x2: 1 }]);
        expect(decisionBoundary([0, 0, 1], 'perceptron')).toEqual([{ x1: -1, x2: 0 }, { x1: 1, x2: 0 }]);
        expect(decisionBoundary([0, 0, 0], 'logistic')).toBeNull();
        expect(decisionBoundary([5, 1, 0], 'logistic')).toBeNull();
        for (const point of decisionBoundary([0.2, 1.1, -0.3], 'logistic') ?? []) {
            expect(linearScore([0.2, 1.1, -0.3], point)).toBeCloseTo(0, 12);
            expect(Math.max(Math.abs(point.x1), Math.abs(point.x2))).toBeLessThanOrEqual(1);
        }
    });

    test('clipped class regions cover the square and respect the decision threshold', () => {
        const weights: LinearWeights = [0.2, 1, 0.3];
        const area = (polygon: PlotPoint[]) => Math.abs(polygon.reduce((sum, point, i) => {
            const next = polygon[(i + 1) % polygon.length];
            return sum + point.x1 * next.x2 - next.x1 * point.x2;
        }, 0)) / 2;
        const blue = classificationRegion(weights, 'least-squares', 1);
        const red = classificationRegion(weights, 'least-squares', 0);
        expect(area(blue) + area(red)).toBeCloseTo(4, 12);
        for (const point of blue) expect(linearScore(weights, point)).toBeGreaterThanOrEqual(0.5 - 1e-12);
        for (const point of red) expect(linearScore(weights, point)).toBeLessThanOrEqual(0.5 + 1e-12);
        expect(classificationRegion([0, 0, 0], 'logistic', 1)).toHaveLength(4);
        expect(classificationRegion([0, 0, 0], 'logistic', 0)).toHaveLength(0);
    });
});
