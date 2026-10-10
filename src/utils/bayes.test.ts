import { describe, expect, test } from 'vitest';
import { calculateBayes } from './bayes';

describe('Bayes frequencies and probabilities', () => {
    test('the beginner spam example splits 180 flags equally between spam and ordinary mail', () => {
        const result = calculateBayes({ prior: 0.1, likelihood: 0.9, falsePositiveRate: 0.1 });
        expect(result.eventCount).toBeCloseTo(100, 12);
        expect(result.complementCount).toBeCloseTo(900, 12);
        expect(result.eventAndEvidenceCount).toBeCloseTo(90, 12);
        expect(result.nonEventAndEvidenceCount).toBeCloseTo(90, 12);
        expect(result.evidenceCount).toBeCloseTo(180, 12);
        expect(result.evidenceProbability).toBeCloseTo(0.18, 12);
        expect(result.posteriorProbability).toBeCloseTo(0.5, 12);
    });

    test('rare events can be outnumbered by false positives despite high sensitivity', () => {
        const result = calculateBayes({ prior: 0.001, likelihood: 0.99, falsePositiveRate: 0.01, population: 100000 });
        expect(result.eventAndEvidenceCount).toBeCloseTo(99, 10);
        expect(result.nonEventAndEvidenceCount).toBeCloseTo(999, 10);
        expect(result.posteriorProbability).toBeCloseTo(99 / 1098, 12);
        expect(result.posteriorProbability).toBeLessThan(0.1);
    });

    test('evidence equally likely in each group leaves the prior unchanged', () => {
        for (const prior of [0, 0.01, 0.2, 0.5, 0.99, 1]) {
            expect(calculateBayes({ prior, likelihood: 0.4, falsePositiveRate: 0.4 }).posteriorProbability).toBeCloseTo(prior, 12);
        }
    });

    test.each([
        [{ prior: 0.3, likelihood: 1, falsePositiveRate: 0 }, 1],
        [{ prior: 0.3, likelihood: 0, falsePositiveRate: 1 }, 0],
        [{ prior: 0, likelihood: 1, falsePositiveRate: 0.2 }, 0],
        [{ prior: 1, likelihood: 0.2, falsePositiveRate: 1 }, 1],
    ] as const)('valid boundary probabilities give the expected posterior', (parameters, expected) => {
        expect(calculateBayes(parameters).posteriorProbability).toBe(expected);
    });

    test.each([
        { prior: 0.5, likelihood: 0, falsePositiveRate: 0 },
        { prior: 0, likelihood: 1, falsePositiveRate: 0 },
        { prior: 1, likelihood: 0, falsePositiveRate: 1 },
    ])('zero-probability evidence produces an undefined posterior', parameters => {
        const result = calculateBayes(parameters);
        expect(result.evidenceProbability).toBe(0);
        expect(result.evidenceCount).toBe(0);
        expect(result.posteriorProbability).toBeNull();
    });

    test('population only scales frequencies and does not round or change the posterior', () => {
        const parameters = { prior: 0.13, likelihood: 0.77, falsePositiveRate: 0.09 };
        const small = calculateBayes({ ...parameters, population: 10 });
        const large = calculateBayes({ ...parameters, population: 1000 });
        expect(small.eventCount).toBe(1.3);
        expect(large.evidenceCount).toBeCloseTo(100 * small.evidenceCount, 12);
        expect(large.posteriorProbability).toBe(small.posteriorProbability);
    });

    test('the population partitions conserve counts and posterior stays bounded across valid models', () => {
        for (const prior of [0, 0.001, 0.1, 0.5, 0.9, 1]) {
            for (const likelihood of [0, 0.1, 0.7, 1]) {
                for (const falsePositiveRate of [0, 0.1, 0.7, 1]) {
                    const result = calculateBayes({ prior, likelihood, falsePositiveRate, population: 2500 });
                    expect(result.eventCount + result.complementCount).toBeCloseTo(2500, 10);
                    expect(result.eventAndEvidenceCount + result.nonEventAndEvidenceCount).toBeCloseTo(result.evidenceCount, 10);
                    expect(result.eventAndEvidenceCount).toBeLessThanOrEqual(result.eventCount + 1e-10);
                    expect(result.nonEventAndEvidenceCount).toBeLessThanOrEqual(result.complementCount + 1e-10);
                    expect(result.evidenceProbability).toBeGreaterThanOrEqual(0);
                    expect(result.evidenceProbability).toBeLessThanOrEqual(1);
                    if (result.posteriorProbability !== null) {
                        expect(result.posteriorProbability).toBeGreaterThanOrEqual(0);
                        expect(result.posteriorProbability).toBeLessThanOrEqual(1);
                        expect(result.posteriorProbability * result.evidenceProbability).toBeCloseTo(prior * likelihood, 12);
                    }
                }
            }
        }
    });

    test('invalid probabilities or populations fail explicitly', () => {
        const parameters = { prior: 0.1, likelihood: 0.9, falsePositiveRate: 0.1 };
        for (const name of ['prior', 'likelihood', 'falsePositiveRate'] as const) {
            for (const value of [-0.1, 1.1, NaN, Infinity, -Infinity]) {
                expect(() => calculateBayes({ ...parameters, [name]: value })).toThrow(RangeError);
            }
        }
        for (const population of [0, -1, NaN, Infinity, -Infinity]) {
            expect(() => calculateBayes({ ...parameters, population })).toThrow(RangeError);
        }
    });
});
