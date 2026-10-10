import { describe, expect, test } from 'vitest';
import { gradientDescentPath, nonconvexGradient, nonconvexLoss, quadraticGradient, quadraticLoss } from './optimization';

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
