import { expect, test } from 'vitest';
import { gaussianDensity, gaussianEllipse, gaussianMahalanobisSquared, gaussianSampleStats, ONE_SIGMA_PROBABILITY, sampleGaussian } from './distributionsMath';

test('correlated samples reproduce and one-sigma membership has the two-dimensional probability', () => {
    for (const parameters of [{ sigmaX: 1, sigmaY: 1, correlation: 0 }, { sigmaX: 0.6, sigmaY: 1.8, correlation: 0.9 }, { sigmaX: 1.8, sigmaY: 0.8, correlation: -0.9 }]) {
        for (const seed of [10, 35, 203]) {
            const samples = sampleGaussian(parameters, 500, seed);
            expect(sampleGaussian(parameters, 500, seed)).toEqual(samples);
            expect(gaussianSampleStats(samples).fractionInside).toBeCloseTo(ONE_SIGMA_PROBABILITY, 1);
            expect(Math.abs(gaussianSampleStats(samples).fractionInside - ONE_SIGMA_PROBABILITY)).toBeLessThan(0.08);
            for (const point of samples) expect(point.insideOneSigma).toBe(gaussianMahalanobisSquared(point.x, point.y, parameters) <= 1);
            for (const [x, y] of gaussianEllipse(parameters)) expect(gaussianMahalanobisSquared(x, y, parameters)).toBeCloseTo(1, 10);
        }
    }
});
test('spread trades peak height for width while normalized density integrates to one', () => {
    const narrow = { sigmaX: 0.6, sigmaY: 0.8, correlation: 0.5 }, wide = { ...narrow, sigmaX: 1.2 };
    expect(gaussianDensity(0, 0, narrow)).toBeCloseTo(2 * gaussianDensity(0, 0, wide), 12);
    const step = 0.04, extent = 6;
    let mass = 0;
    for (let x = -extent + step / 2; x < extent; x += step) for (let y = -extent + step / 2; y < extent; y += step) mass += gaussianDensity(x, y, wide) * step ** 2;
    expect(mass).toBeCloseTo(1, 5);
    expect(() => sampleGaussian({ ...narrow, correlation: 1 }, 50, 1)).toThrow(RangeError);
    expect(() => gaussianDensity(0, 0, { ...narrow, sigmaX: 0 })).toThrow(RangeError);
});
