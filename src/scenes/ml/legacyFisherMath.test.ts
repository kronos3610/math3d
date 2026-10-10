import { expect, test } from 'vitest';
import { fisherClassStats, fisherDirection, pooledProjectionGaussian } from './legacyFisherMath';

test('Fisher uses scatter sums and maximizes mean separation divided by within-class scatter', () => {
    const a = fisherClassStats([{ x: -2, y: -1 }, { x: 0, y: 1 }, { x: 1, y: -1 }, { x: 1, y: 1 }]);
    const b = fisherClassStats([{ x: 2, y: 2 }, { x: 4, y: 4 }, { x: 5, y: 2 }, { x: 5, y: 4 }]);
    expect(a.m).toEqual({ x: 0, y: 0 }); expect(a.sxx).toBe(6); expect(a.syy).toBe(4);
    const direction = fisherDirection(a, b);
    const ratio = (x: number, y: number) => ((b.m.x - a.m.x) * x + (b.m.y - a.m.y) * y) ** 2 / ((a.sxx + b.sxx) * x ** 2 + 2 * (a.sxy + b.sxy) * x * y + (a.syy + b.syy) * y ** 2);
    for (let angle = 0; angle < Math.PI; angle += 0.03) expect(ratio(...direction)).toBeGreaterThanOrEqual(ratio(Math.cos(angle), Math.sin(angle)) - 1e-12);
    expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
});

test('pooled common variance gives an equal-prior Gaussian midpoint intersection', () => {
    const result = pooledProjectionGaussian({ mu: -1, sig: 2 }, { mu: 5, sig: 1 }, 3, 9);
    expect(result.sigma ** 2).toBeCloseTo(1.75, 12); expect(result.threshold).toBe(2);
    const pdf = (mu: number) => Math.exp(-((result.threshold - mu) ** 2) / (2 * result.sigma ** 2)) / (result.sigma * Math.sqrt(2 * Math.PI));
    expect(pdf(-1)).toBe(pdf(5));
});
