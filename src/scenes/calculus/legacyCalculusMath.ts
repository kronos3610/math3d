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
