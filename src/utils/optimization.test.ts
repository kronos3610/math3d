import { describe, expect, test } from 'vitest';
import { gradientDescentPath, gradientDescentTrace, nonconvexGradient, nonconvexLoss, quadraticGradient, quadraticLoss } from './optimization';

describe('gradient descent mathematics', () => {
    test('nonconvex analytic gradient agrees with finite differences', () => {
        const h = 1e-5;
        for (const [x, y] of [[0, 0], [3, 2], [-2, 1], [1, -3]]) {
            const [dx, dy] = nonconvexGradient(x, y);
            expect(dx).toBeCloseTo((nonconvexLoss(x + h, y) - nonconvexLoss(x - h, y)) / (2 * h), 7);
            expect(dy).toBeCloseTo((nonconvexLoss(x, y + h) - nonconvexLoss(x, y - h)) / (2 * h), 7);
        }
    });

    test.each([
        ['quadratic', quadraticLoss, quadraticGradient],
        ['nonconvex', nonconvexLoss, nonconvexGradient],
    ] as const)('%s trajectory decreases loss and converges to a stationary point', (_, loss, gradient) => {
        const path = gradientDescentPath(gradient, [3, 2]);
        for (let i = 1; i < path.length; i++) {
            expect(loss(...path[i])).toBeLessThanOrEqual(loss(...path[i - 1]) + 1e-12);
        }
        expect(Math.hypot(...gradient(...path[path.length - 1]))).toBeLessThan(1e-5);
    });

    test('quadratic updates preserve direction and reach the global minimum', () => {
        const path = gradientDescentPath(quadraticGradient, [3, 2]);
        expect(path[1][0]).toBeCloseTo(2.7);
        expect(path[1][1]).toBeCloseTo(1.8);
        for (const [x, y] of path) expect(x / y).toBeCloseTo(1.5);
        expect(quadraticLoss(...path[path.length - 1])).toBeLessThan(1e-10);
    });
});

test('η=1 reaches the quadratic minimum in one update; η=1.5 alternates and converges', () => {
    expect(gradientDescentTrace(quadraticGradient, [3, 2], { learningRate: 1 })).toEqual({ path: [[3, 2], [0, 0]], status: 'converged' });
    const trace = gradientDescentTrace(quadraticGradient, [3, 2], { learningRate: 1.5 });
    expect(trace.status).toBe('converged');
    trace.path.slice(1).forEach(([x, y], index) => {
        expect(x * trace.path[index][0]).toBeLessThan(0);
        expect(y * trace.path[index][1]).toBeLessThan(0);
        expect(quadraticLoss(x, y)).toBeLessThan(quadraticLoss(...trace.path[index]));
    });
});

test('divergence stops before an escaping/nonfinite iterate enters renderable geometry', () => {
    const trace = gradientDescentTrace(quadraticGradient, [3, 2], { learningRate: 2.2, bound: 6 });
    expect(trace.status).toBe('diverged');
    expect(trace.path.length).toBeGreaterThan(1);
    trace.path.flat().forEach(value => { expect(Number.isFinite(value)).toBe(true); expect(Math.abs(value)).toBeLessThanOrEqual(6); });
    const last = trace.path.at(-1)!;
    expect(Math.abs(last[0] * -1.2)).toBeGreaterThan(6);
    expect(gradientDescentTrace(() => [NaN, Infinity], [1, 1], { learningRate: 1 })).toEqual({ path: [[1, 1]], status: 'diverged' });
});

test('small learning rates decrease loss; η=2 alternates without convergence', () => {
    const slow = gradientDescentTrace(quadraticGradient, [3, 2], { learningRate: 0.1 });
    slow.path.slice(1).forEach((point, index) => expect(quadraticLoss(...point)).toBeLessThan(quadraticLoss(...slow.path[index])));
    const neutral = gradientDescentTrace(quadraticGradient, [3, 2], { learningRate: 2, maxSteps: 10 });
    expect(neutral.status).toBe('max-steps');
    neutral.path.forEach(point => expect(quadraticLoss(...point)).toBe(6.5));
    expect(gradientDescentTrace(quadraticGradient, [0, 0], { learningRate: 2.4 }).status).toBe('converged');
});
