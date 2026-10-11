import { seededRandom } from '../../utils/regression';

export interface MonteCarloPoint { position: [number, number, number]; inside: boolean; }
export interface MonteCarloEstimate { total: number; inside: number; estimate: number; error: number; standardError: number; }
export interface MonteCarloRun { points: MonteCarloPoint[]; prefixInside: number[]; }

/** Unit sphere inside [-1, 1]³: its volume fraction is π/6. */
export function makeMonteCarloRun(seed: number, budget: number): MonteCarloRun {
    if (!Number.isInteger(budget) || budget < 1 || budget > 10000 || !Number.isFinite(seed)) throw new RangeError('Use a finite seed and a sample budget from 1 to 10000.');
    const random = seededRandom(seed);
    const points: MonteCarloPoint[] = [];
    const prefixInside = [0];
    for (let index = 0; index < budget; index++) {
        const position: [number, number, number] = [2 * random() - 1, 2 * random() - 1, 2 * random() - 1];
        const inside = position.reduce((sum, value) => sum + value * value, 0) <= 1;
        points.push({ position, inside });
        prefixInside.push(prefixInside[index] + Number(inside));
    }
    return { points, prefixInside };
}

export function monteCarloEstimate(run: MonteCarloRun, count: number): MonteCarloEstimate {
    const total = Math.max(0, Math.min(run.points.length, Math.floor(Number.isFinite(count) ? count : 0)));
    const inside = run.prefixInside[total];
    const estimate = total === 0 ? 0 : 6 * inside / total;
    // Population-based standard error, not a confidence guarantee for one run.
    const p = Math.PI / 6;
    return { total, inside, estimate, error: Math.abs(estimate - Math.PI), standardError: total === 0 ? 0 : 6 * Math.sqrt(p * (1 - p) / total) };
}

/** Log-spaced checkpoints preserve early fluctuations and never exceed maxPoints. */
export function monteCarloHistory(run: MonteCarloRun, count: number, maxPoints = 200): MonteCarloEstimate[] {
    if (!Number.isInteger(maxPoints) || maxPoints < 2) throw new RangeError('History needs at least two checkpoints.');
    const total = monteCarloEstimate(run, count).total;
    if (total === 0) return [];
    const counts = new Set<number>([1, total]);
    for (let index = 0; index < maxPoints; index++) counts.add(Math.max(1, Math.round(Math.exp(Math.log(total) * index / (maxPoints - 1)))));
    return [...counts].sort((a, b) => a - b).map(n => monteCarloEstimate(run, n));
}
