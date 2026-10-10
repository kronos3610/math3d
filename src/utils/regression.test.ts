import { expect, test } from 'vitest';
import { evaluatePolynomial, fitPolynomial, sampleNormal, seededRandom } from './regression';

test('unregularized fit reproduces a known quadratic throughout the domain', () => {
    const signal = (x: number) => 2 + 3 * x - 4 * x * x;
    const samples = [-1, -0.7, -0.2, 0.1, 0.5, 1].map(x => ({ x, y: signal(x) }));
    const coefficients = fitPolynomial(samples, 2, 0);
    for (const x of [-0.9, -0.35, 0, 0.4, 0.8]) {
        expect(evaluatePolynomial(coefficients, x)).toBeCloseTo(signal(x), 10);
    }
});

test('unpenalized intercept equals the sample mean', () => {
    const coefficients = fitPolynomial([{ x: -1, y: 2 }, { x: 0, y: 5 }, { x: 1, y: 8 }], 0, 100);
    expect(coefficients[0]).toBeCloseTo(5, 10);
});

test('ridge stabilizes repeated positions and an underdetermined polynomial', () => {
    const coefficients = fitPolynomial([{ x: 0.3, y: 2 }, { x: 0.3, y: 4 }], 9);
    expect(evaluatePolynomial(coefficients, 0.3)).toBeCloseTo(3, 6);
    for (const x of [-1, 0, 1]) expect(Number.isFinite(evaluatePolynomial(coefficients, x))).toBe(true);
});

test('invalid and rank-deficient unregularized designs fail explicitly', () => {
    expect(() => fitPolynomial([], 2)).toThrow(RangeError);
    expect(() => fitPolynomial([{ x: 2, y: 1 }], 0)).toThrow(RangeError);
    expect(() => fitPolynomial([{ x: 0, y: 1 }], 2, 0)).toThrow(RangeError);
    expect(() => fitPolynomial([{ x: 0, y: 1 }, { x: 0, y: 2 }], 1, 0)).toThrow(RangeError);
});

test('seeded normal sampling is repeatable, centered, and has unit variance', () => {
    const first = seededRandom(31);
    const second = seededRandom(31);
    expect(Array.from({ length: 20 }, () => first())).toEqual(Array.from({ length: 20 }, () => second()));
    const random = seededRandom(12);
    let sum = 0;
    let squares = 0;
    for (let i = 0; i < 20000; i++) {
        const value = sampleNormal(random);
        sum += value;
        squares += value * value;
    }
    expect(Math.abs(sum / 20000)).toBeLessThan(0.03);
    expect(squares / 20000).toBeCloseTo(1, 1);
});
