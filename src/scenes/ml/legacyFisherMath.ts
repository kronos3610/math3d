export interface FisherPoint { x: number; y: number; }
export function fisherClassStats(points: readonly FisherPoint[]) {
    if (points.length === 0) throw new Error('A class requires observations.');
    const m = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
    return { m, sxx: points.reduce((sum, point) => sum + (point.x - m.x) ** 2, 0), syy: points.reduce((sum, point) => sum + (point.y - m.y) ** 2, 0), sxy: points.reduce((sum, point) => sum + (point.x - m.x) * (point.y - m.y), 0) };
}

export function fisherDirection(first: ReturnType<typeof fisherClassStats>, second: ReturnType<typeof fisherClassStats>): [number, number] {
    const xx = first.sxx + second.sxx; const yy = first.syy + second.syy; const xy = first.sxy + second.sxy;
    const determinant = xx * yy - xy ** 2;
    if (!(determinant > 0)) throw new Error('This Fisher solve requires positive-definite within-class scatter.');
    const dx = second.m.x - first.m.x; const dy = second.m.y - first.m.y;
    const direction: [number, number] = [(yy * dx - xy * dy) / determinant, (xx * dy - xy * dx) / determinant];
    const length = Math.hypot(...direction);
    if (length === 0) throw new Error('Equal means do not determine a separating Fisher direction.');
    return [direction[0] / length, direction[1] / length];
}

/** Maximum-likelihood pooled variance; equal priors then give a midpoint cutoff. */
export function pooledProjectionGaussian(first: { mu: number; sig: number }, second: { mu: number; sig: number }, firstCount: number, secondCount: number) {
    const variance = (firstCount * first.sig ** 2 + secondCount * second.sig ** 2) / (firstCount + secondCount);
    return { sigma: Math.sqrt(variance), threshold: (first.mu + second.mu) / 2 };
}
