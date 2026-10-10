export type Weight3 = readonly [number, number, number];
export type BudgetNorm = 'ridge' | 'lasso';
export const QUADRATIC_CENTER: Weight3 = [3, 2.5, 2];
export const QUADRATIC_CURVATURE: Weight3 = [1, 2, 4];

export function quadraticWeightLoss(weights: Weight3, center: Weight3 = QUADRATIC_CENTER, curvature: Weight3 = QUADRATIC_CURVATURE): number {
    return weights.reduce((sum, weight, index) => sum + curvature[index] * (weight - center[index]) ** 2 / 2, 0);
}

export function weightNorm(weights: Weight3, norm: BudgetNorm): number {
    return norm === 'ridge' ? Math.hypot(...weights) : weights.reduce((sum, value) => sum + Math.abs(value), 0);
}

/** Solve a strictly convex diagonal quadratic under an L2-radius or L1 budget. */
export function solveBudgetQuadratic(norm: BudgetNorm, budget: number, center: Weight3 = QUADRATIC_CENTER, curvature: Weight3 = QUADRATIC_CURVATURE): Weight3 {
    if (!Number.isFinite(budget) || budget < 0 || center.some(value => !Number.isFinite(value)) || curvature.some(value => !Number.isFinite(value) || value <= 0)) {
        throw new Error('Use a finite nonnegative budget, finite center, and positive curvatures.');
    }
    if (weightNorm(center, norm) <= budget) return [...center] as [number, number, number];
    if (budget === 0) return [0, 0, 0];
    const atMultiplier = (multiplier: number): Weight3 => center.map((value, index) => norm === 'ridge'
        ? curvature[index] * value / (curvature[index] + multiplier)
        : Math.sign(value) * Math.max(0, Math.abs(value) - multiplier / curvature[index])) as [number, number, number];
    let lower = 0;
    let upper = 1;
    while (weightNorm(atMultiplier(upper), norm) > budget) upper *= 2;
    for (let iteration = 0; iteration < 80; iteration++) {
        const middle = (lower + upper) / 2;
        if (weightNorm(atMultiplier(middle), norm) > budget) lower = middle;
        else upper = middle;
    }
    return atMultiplier(upper);
}

/** Radial intersection, intentionally distinct from nearest-point projection. */
export function radialNormShrink(weights: Weight3, p: number, radius: number): Weight3 {
    if (!(p >= 1) || !Number.isFinite(radius) || radius < 0 || weights.some(value => !Number.isFinite(value))) throw new Error('Use finite weights, p ≥ 1, and a finite nonnegative radius.');
    const norm = p === Infinity ? Math.max(...weights.map(Math.abs)) : weights.reduce((sum, value) => sum + Math.abs(value) ** p, 0) ** (1 / p);
    const scale = norm > radius ? radius / norm : 1;
    return weights.map(value => value * scale) as [number, number, number];
}
