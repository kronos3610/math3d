export const sineCosineSurface = (x: number, y: number): number => Math.sin(x) * Math.cos(y);
export const sineCosineGradient = (x: number, y: number): [number, number] => [Math.cos(x) * Math.cos(y), -Math.sin(x) * Math.sin(y)];
export const sineCosineHessian = (x: number, y: number): [[number, number], [number, number]] => {
    const diagonal = -Math.sin(x) * Math.cos(y);
    const cross = -Math.cos(x) * Math.sin(y);
    return [[diagonal, cross], [cross, diagonal]];
};

export function sineCosineTaylor(x: number, y: number, dx: number, dy: number): number {
    const gradient = sineCosineGradient(x, y); const hessian = sineCosineHessian(x, y);
    return sineCosineSurface(x, y) + gradient[0] * dx + gradient[1] * dy + (hessian[0][0] * dx ** 2 + 2 * hessian[0][1] * dx * dy + hessian[1][1] * dy ** 2) / 2;
}

export const derivativeFunction = (x: number, y: number): number => 0.8 * sineCosineSurface(x, y);
export function derivativeSlice(x: number, y: number, h: number) {
    if (![x, y, h].every(Number.isFinite) || h <= 0) throw new Error('Use finite coordinates and a positive secant step.');
    const value = derivativeFunction(x, y);
    const nextValue = derivativeFunction(x + h, y);
    const tangent = 0.8 * sineCosineGradient(x, y)[0];
    const secant = (nextValue - value) / h;
    return { value, nextValue, tangent, secant, difference: secant - tangent };
}

/** Signed midpoint accumulation, including a reversed integration interval. */
export function accumulate(f: (x: number) => number, a: number, x: number, n = 400): number {
    if (![a, x].every(Number.isFinite) || !Number.isInteger(n) || n < 1) throw new Error('Use finite endpoints and a positive integer partition count.');
    const width = (x - a) / n;
    let sum = 0;
    for (let index = 0; index < n; index++) {
        const value = f(a + (index + 0.5) * width);
        if (!Number.isFinite(value)) throw new Error('Accumulation requires finite sampled values.');
        sum += value * width;
    }
    return sum;
}

export const sineAccumulation = (x: number): number => 1 - Math.cos(x);
export const sineAccumulationSlope = (x: number, h = 1e-4): number => (sineAccumulation(x + h) - sineAccumulation(x - h)) / (2 * h);
