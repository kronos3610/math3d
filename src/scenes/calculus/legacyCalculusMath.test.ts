import { expect, test } from 'vitest';
import { accumulate, derivativeSlice, sineAccumulation, sineAccumulationSlope, sineCosineGradient as gradient, sineCosineHessian as hessian, sineCosineSurface as f, sineCosineTaylor as taylor } from './legacyCalculusMath';
import { ELLIPSOID_AXES, ELLIPSOID_VOLUME, ellipsoidGridCover } from './ellipsoidCover';

test('gradient and Hessian match independent finite differences, including mixed curvature', () => {
    for (const [x, y] of [[0.5, 0.8], [-1.1, 0.4], [2, -1]]) {
        const h = 1e-5; const g = gradient(x, y); const H = hessian(x, y);
        expect(g[0]).toBeCloseTo((f(x + h, y) - f(x - h, y)) / (2 * h), 8);
        expect(g[1]).toBeCloseTo((f(x, y + h) - f(x, y - h)) / (2 * h), 8);
        expect(H[0][1]).toBeCloseTo((gradient(x, y + h)[0] - gradient(x, y - h)[0]) / (2 * h), 8);
        expect(H[1][0]).toBeCloseTo((gradient(x + h, y)[1] - gradient(x - h, y)[1]) / (2 * h), 8);
    }
});

test('forward secants converge to the analytic slice derivative as their step halves', () => {
    let error = Infinity;
    for (const h of [0.8, 0.4, 0.2, 0.1, 0.05, 0.01]) {
        const values = derivativeSlice(0.8, 0.6, h);
        expect(Math.abs(values.difference)).toBeLessThan(error);
        error = Math.abs(values.difference);
    }
    expect(error).toBeLessThan(0.003);
});

test('midpoint accumulation matches the signed sine integral and its slope matches the integrand', () => {
    for (const x of [0, 0.3, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2 * Math.PI]) {
        expect(Math.abs(accumulate(Math.sin, 0, x, 400) - sineAccumulation(x))).toBeLessThan(1e-3);
        expect(sineAccumulationSlope(x)).toBeCloseTo(Math.sin(x), 7);
    }
    expect(accumulate(Math.sin, Math.PI, 0, 400)).toBeCloseTo(-2, 4);
});

test('quadratic patch follows both world input directions with third-order local error', () => {
    const error = (h: number) => Math.abs(f(0.5 + h, 0.8 + h / 2) - taylor(0.5, 0.8, h, h / 2));
    expect(error(0.01)).toBeLessThan(error(0.02) / 7);
    expect(taylor(0.5, 0.8, 0, 0)).toBe(f(0.5, 0.8));
});

test('intersecting-box covers contain the full ellipsoid and nested refinements tighten the volume bound', () => {
    let previous = Infinity;
    for (const divisions of [4, 8, 16, 32]) {
        const boxes = ellipsoidGridCover(divisions); const size = 4 / divisions;
        const volume = boxes.length * size ** 3;
        expect(volume).toBeGreaterThanOrEqual(ELLIPSOID_VOLUME);
        expect(volume).toBeLessThan(previous); previous = volume;
        const occupied = new Set(boxes.map(cell => cell.position.map(value => Math.round((value + 2) / size - 0.5)).join(',')));
        for (let theta = 0; theta < 2 * Math.PI; theta += 0.13) for (let phi = 0; phi <= Math.PI; phi += 0.17) {
            const point = [ELLIPSOID_AXES[0] * Math.sin(phi) * Math.cos(theta), ELLIPSOID_AXES[1] * Math.sin(phi) * Math.sin(theta), ELLIPSOID_AXES[2] * Math.cos(phi)];
            expect(occupied.has(point.map(value => Math.floor((value + 2) / size)).join(','))).toBe(true);
        }
    }
});
