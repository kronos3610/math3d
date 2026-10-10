export type MixturePoint = readonly [number, number, number];
export interface MixtureParameters { means: MixturePoint[]; variances: MixturePoint[]; weights: number[]; }

export function diagonalMixtureEStep(data: readonly MixturePoint[], model: MixtureParameters) {
    const responsibilities: number[][] = [];
    let logLikelihood = 0;
    for (const point of data) {
        const logs = model.means.map((mean, component) => model.weights[component] > 0
            ? Math.log(model.weights[component]) - 1.5 * Math.log(2 * Math.PI) - mean.reduce((sum, value, axis) => sum + (Math.log(model.variances[component][axis]) + (point[axis] - value) ** 2 / model.variances[component][axis]) / 2, 0)
            : -Infinity);
        const maximum = Math.max(...logs);
        if (!Number.isFinite(maximum)) throw new Error('The mixture needs finite points, positive variances, and at least one positive weight.');
        const scaled = logs.map(value => Math.exp(value - maximum));
        const sum = scaled.reduce((total, value) => total + value, 0);
        responsibilities.push(scaled.map(value => value / sum));
        logLikelihood += maximum + Math.log(sum);
    }
    return { responsibilities, logLikelihood };
}

export function diagonalMixtureMStep(data: readonly MixturePoint[], responsibilities: readonly number[][], previous: MixtureParameters, varianceFloor = 0.5): MixtureParameters {
    if (data.length === 0 || data.length !== responsibilities.length || !(varianceFloor > 0)) throw new Error('Use observations, matching responsibilities, and a positive variance floor.');
    const means: MixturePoint[] = []; const variances: MixturePoint[] = []; const weights: number[] = [];
    for (let component = 0; component < previous.means.length; component++) {
        const mass = responsibilities.reduce((sum, row) => sum + row[component], 0);
        weights.push(mass / data.length);
        if (mass === 0) { means.push(previous.means[component]); variances.push(previous.variances[component]); continue; }
        const mean = [0, 1, 2].map(axis => data.reduce((sum, point, index) => sum + responsibilities[index][component] * point[axis], 0) / mass) as [number, number, number];
        means.push(mean);
        variances.push([0, 1, 2].map(axis => Math.max(varianceFloor, data.reduce((sum, point, index) => sum + responsibilities[index][component] * (point[axis] - mean[axis]) ** 2, 0) / mass)) as [number, number, number]);
    }
    return { means, variances, weights };
}
