import { describe, expect, test } from 'vitest';
import {
    createFeatureProblem, createRegressionData, featureDescent, featureGradient, featureLoss,
    fitPolynomial, measureLoss, polynomialPrediction, regressionMSE, type LossKind,
} from './ml-losses';

describe('loss geometry', () => {
    test.each(['squared', 'absolute', 'huber', 'bce'] as LossKind[])('%s slopes agree with finite differences away from corners', kind => {
        const prediction = 1.4; const target = kind === 'bce' ? 0.3 : -0.1;
        const result = measureLoss(kind, prediction, target, 0.7);
        const numerical = (measureLoss(kind, prediction + 1e-5, target, 0.7).loss - measureLoss(kind, prediction - 1e-5, target, 0.7).loss) / 2e-5;
        expect(result.slope).toBeCloseTo(numerical, 8);
    });
    test('absolute loss exposes its corner and Huber has bounded influence and continuous slope', () => {
        expect(measureLoss('absolute', 0, 0).slope).toBeNull();
        expect(measureLoss('huber', 100, 0, 0.5).slope).toBe(0.5);
        expect(measureLoss('huber', 0.5, 0, 0.5).curvature).toBeNull();
        expect(measureLoss('huber', 0.5 - 1e-7, 0, 0.5).slope).toBeCloseTo(measureLoss('huber', 0.5 + 1e-7, 0, 0.5).slope!, 6);
    });
    test('logit cross entropy stays finite for extreme confidence and supports genuine soft targets', () => {
        expect(measureLoss('bce', 1000, 0).loss).toBe(1000);
        expect(measureLoss('bce', -1000, 1).loss).toBe(1000);
        expect(measureLoss('bce', 1000, 1).loss).toBe(0);
        const target = 0.3; const logit = Math.log(target / (1 - target));
        expect(measureLoss('bce', logit, target).slope).toBeCloseTo(0, 12);
        expect(() => measureLoss('bce', 0, 2)).toThrow();
    });
});

describe('training and validation evidence', () => {
    test('a noiseless linear relationship is fit and validated independently', () => {
        const data = createRegressionData(12, 0, false);
        const coefficients = fitPolynomial(data.training, 1);
        expect(coefficients[0]).toBeCloseTo(-0.2, 6);
        expect(coefficients[1]).toBeCloseTo(1.2, 6);
        expect(regressionMSE(data.validation, coefficients)).toBeLessThan(1e-12);
        expect(data.training.map(point => point.input)).not.toEqual(data.validation.slice(0, 12).map(point => point.input));
    });
    test('fitting uses training targets only and a training outlier changes no validation values', () => {
        const original = createRegressionData(12, 0.25, true, false);
        const contaminated = createRegressionData(12, 0.25, true, true);
        expect(contaminated.validation).toEqual(original.validation);
        expect(contaminated.training.filter((point, index) => point.target !== original.training[index].target)).toHaveLength(1);
        const coefficients = fitPolynomial(original.training, 3);
        original.validation.forEach(point => { point.target += 100; });
        expect(fitPolynomial(original.training, 3)).toEqual(coefficients);
        expect(regressionMSE(original.validation, coefficients)).toBeGreaterThan(9000);
    });
    test('high-degree finite fits remain numerical at the smallest supported sample size', () => {
        const data = createRegressionData(6, 0.7, true, true);
        const coefficients = fitPolynomial(data.training, 8);
        expect(coefficients.every(Number.isFinite)).toBe(true);
        for (let index = 0; index <= 80; index++) expect(Number.isFinite(polynomialPrediction(-1 + index / 40, coefficients))).toBe(true);
    });
    test('a more flexible model can improve training error while worsening independent validation error', () => {
        const data = createRegressionData(12, 0.25, true, false);
        const modest = fitPolynomial(data.training, 3);
        const flexible = fitPolynomial(data.training, 8);
        expect(regressionMSE(data.training, flexible)).toBeLessThan(regressionMSE(data.training, modest));
        expect(regressionMSE(data.validation, flexible)).toBeGreaterThan(regressionMSE(data.validation, modest));
    });
});

describe('feature conditioning and actual optimization', () => {
    test('known covariance gives exact eigenvalues; standardizing scale does not remove correlation', () => {
        const raw = createFeatureProblem(5, 0);
        expect(raw.eigenvalues[0]).toBeCloseTo(1, 12);
        expect(raw.eigenvalues[1]).toBeCloseTo(25, 12);
        expect(raw.condition).toBeCloseTo(25, 12);
        const normalized = createFeatureProblem(5, 0.8, true);
        expect(normalized.eigenvalues[0]).toBeCloseTo(0.2, 12);
        expect(normalized.eigenvalues[1]).toBeCloseTo(1.8, 12);
        expect(normalized.condition).toBeCloseTo(9, 12);
        expect(featureLoss(raw, raw.optimum)).toBeLessThan(1e-25);
        expect(featureLoss(normalized, normalized.optimum)).toBeLessThan(1e-25);
    });
    test('feature gradients match finite differences and stable descent lowers the actual objective', () => {
        const problem = createFeatureProblem(3, 0.6);
        const weights: [number, number] = [0.3, -0.2];
        const gradient = featureGradient(problem, weights);
        for (let i = 0; i < 2; i++) {
            const plus: [number, number] = [...weights]; const minus: [number, number] = [...weights];
            plus[i] += 1e-5; minus[i] -= 1e-5;
            expect(gradient[i]).toBeCloseTo((featureLoss(problem, plus) - featureLoss(problem, minus)) / 2e-5, 8);
        }
        const path = featureDescent(problem, 1 / problem.eigenvalues[1], 60);
        expect(path.stopped).toBe(false);
        path.steps.slice(1).forEach((row, index) => expect(row.loss).toBeLessThanOrEqual(path.steps[index].loss + 1e-12));
        expect(path.steps.at(-1)!.loss).toBeLessThan(path.steps[0].loss / 100);
    });
    test('unstable rates show genuine divergence and stop before storing unbounded/nonfinite values', () => {
        const problem = createFeatureProblem(8, 0.9);
        const path = featureDescent(problem, 0.3, 60);
        expect(path.stopped).toBe(true);
        expect(path.steps.at(-1)!.loss).toBeGreaterThan(path.steps[0].loss);
        expect(path.steps.every(row => Number.isFinite(row.loss) && row.loss <= 1e6 && row.weights.every(Number.isFinite))).toBe(true);
    });
});
