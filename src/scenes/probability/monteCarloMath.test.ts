import { expect, test } from 'vitest';
import { makeMonteCarloRun, monteCarloEstimate, monteCarloHistory } from './monteCarloMath';

test('seeded sampling repeats, preserves prefixes across budgets and uses the actual 3D sphere test', () => {
    const short = makeMonteCarloRun(7, 100), long = makeMonteCarloRun(7, 10000);
    expect(makeMonteCarloRun(7, 100)).toEqual(short);
    expect(long.points.slice(0, 100)).toEqual(short.points);
    expect(makeMonteCarloRun(8, 100).points).not.toEqual(short.points);
    let inside = 0;
    for (const [i, point] of long.points.entries()) {
        expect(point.position.every(value => value >= -1 && value <= 1)).toBe(true);
        expect(point.inside).toBe(point.position.reduce((sum, value) => sum + value ** 2, 0) <= 1);
        inside += Number(point.inside);
        expect(long.prefixInside[i + 1]).toBe(inside);
    }
    const stats = monteCarloEstimate(long, 10000);
    expect(stats.estimate).toBe(6 * inside / 10000);
    expect(stats.error).toBe(Math.abs(stats.estimate - Math.PI));
    expect(stats.error).toBeLessThan(0.08);
});
test('history includes the current estimate, bounds rendering work, and has the correct root-n scale', () => {
    const run = makeMonteCarloRun(23, 10000);
    for (const count of [0, 1, 2, 50, 10000]) {
        const history = monteCarloHistory(run, count);
        expect(history.length).toBeLessThanOrEqual(200);
        expect(history.every(p => Object.values(p).every(Number.isFinite))).toBe(true);
        if (count) expect(history.at(-1)).toEqual(monteCarloEstimate(run, count));
    }
    expect(monteCarloEstimate(run, 100).standardError / monteCarloEstimate(run, 10000).standardError).toBeCloseTo(10, 12);
    expect(() => makeMonteCarloRun(2, 10001)).toThrow(RangeError);
    expect(() => makeMonteCarloRun(NaN, 100)).toThrow(RangeError);
});
