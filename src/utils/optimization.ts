export type Point2 = readonly [number, number];
export type Objective = (x: number, y: number) => number;
export type Gradient = (x: number, y: number) => Point2;

export const quadraticLoss: Objective = (x, y) => 0.5 * (x * x + y * y);
export const quadraticGradient: Gradient = (x, y) => [x, y];

export const nonconvexLoss: Objective = (x, y) =>
    0.08 * (x * x + y * y) +
    0.4 * Math.sin(1.5 * x) * Math.cos(1.5 * y) +
    0.5 * Math.sin(0.3 * x);

export const nonconvexGradient: Gradient = (x, y) => [
    0.16 * x + 0.6 * Math.cos(1.5 * x) * Math.cos(1.5 * y) + 0.15 * Math.cos(0.3 * x),
    0.16 * y - 0.6 * Math.sin(1.5 * x) * Math.sin(1.5 * y),
];

export interface DescentOptions { learningRate: number; maxSteps?: number; bound?: number; tolerance?: number; }
export interface DescentTrace { path: Point2[]; status: 'converged' | 'diverged' | 'max-steps'; }

/** Stop before a nonfinite or out-of-domain update can enter rendered geometry. */
export function gradientDescentTrace(gradient: Gradient, start: Point2, { learningRate, maxSteps = 160, bound = 6, tolerance = 1e-5 }: DescentOptions): DescentTrace {
    if (!Number.isFinite(learningRate) || learningRate <= 0 || !Number.isInteger(maxSteps) || maxSteps < 0 || !Number.isFinite(bound) || bound <= 0 || !Number.isFinite(tolerance) || tolerance <= 0 || start.some(value => !Number.isFinite(value) || Math.abs(value) > bound)) throw new Error('Use finite, positive descent settings and a start inside the plotted domain.');
    const path: Point2[] = [[...start]];
    let [x, y] = start;
    for (let step = 0; step <= maxSteps; step++) {
        const [dx, dy] = gradient(x, y);
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { path, status: 'diverged' };
        if (Math.hypot(dx, dy) < tolerance) return { path, status: 'converged' };
        if (step === maxSteps) return { path, status: 'max-steps' };
        const nextX = x - learningRate * dx; const nextY = y - learningRate * dy;
        if (![nextX, nextY].every(value => Number.isFinite(value) && Math.abs(value) <= bound)) return { path, status: 'diverged' };
        x = nextX; y = nextY; path.push([x, y]);
    }
    return { path, status: 'max-steps' };
}

/** Fixed-step gradient descent; the scene animates these actual iterates. */
export function gradientDescentPath(
    gradient: Gradient,
    start: Point2,
    learningRate = 0.1,
    maxSteps = 500,
): Point2[] {
    const path: Point2[] = [start];
    let [x, y] = start;
    for (let i = 0; i < maxSteps; i++) {
        const [dx, dy] = gradient(x, y);
        if (Math.hypot(dx, dy) < 1e-5) break;
        x -= learningRate * dx;
        y -= learningRate * dy;
        path.push([x, y]);
    }
    return path;
}
