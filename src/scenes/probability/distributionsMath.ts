import { sampleNormal, seededRandom } from '../../utils/regression';

export interface GaussianParameters { sigmaX: number; sigmaY: number; correlation: number; }
export interface GaussianSample { x: number; y: number; insideOneSigma: boolean; }
export const ONE_SIGMA_PROBABILITY = 1 - Math.exp(-0.5);

function validate(parameters: GaussianParameters) {
    if (!Number.isFinite(parameters.sigmaX) || !Number.isFinite(parameters.sigmaY) || parameters.sigmaX <= 0 || parameters.sigmaY <= 0 || !Number.isFinite(parameters.correlation) || Math.abs(parameters.correlation) >= 1) throw new RangeError('Standard deviations must be positive and correlation must be strictly between -1 and 1.');
}
export function gaussianMahalanobisSquared(x: number, y: number, parameters: GaussianParameters): number {
    validate(parameters);
    const a = x / parameters.sigmaX, b = y / parameters.sigmaY, rho = parameters.correlation;
    return (a * a - 2 * rho * a * b + b * b) / (1 - rho * rho);
}
export function gaussianDensity(x: number, y: number, parameters: GaussianParameters): number {
    return Math.exp(-gaussianMahalanobisSquared(x, y, parameters) / 2) / (2 * Math.PI * parameters.sigmaX * parameters.sigmaY * Math.sqrt(1 - parameters.correlation ** 2));
}
export function gaussianEllipse(parameters: GaussianParameters, steps = 96): [number, number][] {
    validate(parameters);
    if (!Number.isInteger(steps) || steps < 4) throw new RangeError('Use at least four ellipse segments.');
    return Array.from({ length: steps + 1 }, (_, index) => {
        const angle = 2 * Math.PI * index / steps;
        return [parameters.sigmaX * Math.cos(angle), parameters.sigmaY * (parameters.correlation * Math.cos(angle) + Math.sqrt(1 - parameters.correlation ** 2) * Math.sin(angle))];
    });
}
export function sampleGaussian(parameters: GaussianParameters, count: number, seed: number): GaussianSample[] {
    validate(parameters);
    if (!Number.isInteger(count) || count < 1 || count > 10000 || !Number.isFinite(seed)) throw new RangeError('Use a finite seed and sample count from 1 to 10000.');
    const random = seededRandom(seed);
    return Array.from({ length: count }, () => {
        const a = sampleNormal(random), b = sampleNormal(random);
        const x = parameters.sigmaX * a;
        const y = parameters.sigmaY * (parameters.correlation * a + Math.sqrt(1 - parameters.correlation ** 2) * b);
        return { x, y, insideOneSigma: a * a + b * b <= 1 };
    });
}
export function gaussianSampleStats(samples: readonly GaussianSample[]) {
    if (samples.length === 0) throw new RangeError('At least one observation is required.');
    const meanX = samples.reduce((sum, point) => sum + point.x, 0) / samples.length;
    const meanY = samples.reduce((sum, point) => sum + point.y, 0) / samples.length;
    return { meanX, meanY,
        stdX: Math.sqrt(samples.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0) / samples.length),
        stdY: Math.sqrt(samples.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0) / samples.length),
        fractionInside: samples.filter(point => point.insideOneSigma).length / samples.length };
}
