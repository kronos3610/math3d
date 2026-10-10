import { seededRandom } from './regression';

export type Vector3 = [number, number, number];
export type AttentionMask = 'bidirectional' | 'causal' | 'local';
export type PositionEncoding = 'none' | 'sinusoidal' | 'rope';
export type KVLayout = 'mha' | 'gqa' | 'mqa' | 'mla';
export interface AttentionOptions {
    heads?: number; mask?: AttentionMask; window?: number; position?: PositionEncoding;
    offset?: number; maskOffset?: number; queryScale?: number; kvLayout?: KVLayout; seed?: number; padding?: number;
    keyInputs?: readonly Vector3[];
}
export interface HeadTrace {
    queries: number[][]; keys: number[][]; values: Vector3[];
    scores: number[][]; weights: number[][]; outputs: Vector3[]; group: number;
}
export interface AttentionTrace { inputs: Vector3[]; heads: HeadTrace[]; outputs: Vector3[]; }

export const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const matvec = (matrix: readonly (readonly number[])[], vector: readonly number[]): number[] => matrix.map(row => dot(row, vector));
export const magnitude = (vector: readonly number[]): number => Math.sqrt(dot(vector, vector));
export const add3 = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (vector: Vector3, scale: number): Vector3 => [vector[0] * scale, vector[1] * scale, vector[2] * scale];
export function softmax(scores: readonly number[]): number[] {
    const maximum = Math.max(...scores);
    if (maximum === -Infinity) return scores.map(() => 0);
    const values = scores.map(value => value === -Infinity ? 0 : Math.exp(value - maximum));
    const total = values.reduce((sum, value) => sum + value, 0);
    return values.map(value => value / total);
}
export function projection(rows: number, columns: number, seed: number): number[][] {
    const random = seededRandom(seed);
    return Array.from({ length: rows }, () => Array.from({ length: columns }, () => (random() * 2 - 1) / Math.sqrt(columns)));
}
export function rotatePairs(vector: readonly number[], angle: number): number[] {
    const result = [...vector];
    for (let index = 0; index + 1 < vector.length; index += 2) {
        const theta = angle / Math.pow(10000, index / vector.length);
        result[index] = vector[index] * Math.cos(theta) - vector[index + 1] * Math.sin(theta);
        result[index + 1] = vector[index] * Math.sin(theta) + vector[index + 1] * Math.cos(theta);
    }
    return result;
}
function positionInput(input: Vector3, position: number, encoding: PositionEncoding): Vector3 {
    return encoding === 'sinusoidal' ? [input[0] + Math.sin(position), input[1] + Math.cos(position), input[2] + Math.sin(position / 100)] : [...input];
}
export function permitted(query: number, key: number, count: number, options: AttentionOptions): boolean {
    if (key >= count - (options.padding ?? 0)) return false;
    if (options.mask === 'causal') return key <= query + (options.maskOffset ?? 0);
    if (options.mask === 'local') return key === 0 || query === 0 || Math.abs(query - key) <= (options.window ?? 1);
    return true;
}
export function kvGroups(heads: number, layout: KVLayout): number {
    return layout === 'mqa' ? 1 : layout === 'gqa' ? Math.max(1, Math.ceil(heads / 2)) : heads;
}
export function kvElements(count: number, heads: number, layout: KVLayout): number {
    // MLA teaching core: two shared content-latent coordinates plus two RoPE key coordinates.
    return count * (layout === 'mla' ? 4 : 2 * 3 * kvGroups(heads, layout));
}

/** Explicit small projections; these are demonstration parameters, not pretrained language weights. */
export function runAttention(inputs: readonly Vector3[], options: AttentionOptions = {}): AttentionTrace {
    const heads = options.heads ?? 2; const seed = options.seed ?? 3610;
    const encoding = options.position ?? 'none'; const offset = options.offset ?? 0;
    const sources = options.keyInputs ?? inputs; const layout = options.kvLayout ?? 'mha';
    const queryInputs = inputs.map((input, index) => positionInput(input, index + offset, encoding));
    const keyInputs = sources.map((input, index) => positionInput(input, index + (options.keyInputs ? 0 : offset), encoding));
    const traces: HeadTrace[] = [];
    for (let head = 0; head < heads; head++) {
        const group = Math.min(kvGroups(heads, layout) - 1, Math.floor(head * kvGroups(heads, layout) / heads));
        let queries: number[][]; let keys: number[][]; let values: Vector3[];
        if (layout === 'mla') {
            const latent = keyInputs.map(input => matvec(projection(2, 3, seed + 500), input));
            const contentQ = queryInputs.map(input => matvec(projection(2, 3, seed + head * 17), input));
            const rotaryQ = queryInputs.map((input, index) => rotatePairs(matvec(projection(2, 3, seed + 700 + head * 17), input), index + offset));
            const rotaryK = keyInputs.map((input, index) => rotatePairs(matvec(projection(2, 3, seed + 750), input), index + (options.keyInputs ? 0 : offset)));
            queries = contentQ.map((q, index) => [...q, ...rotaryQ[index]].map(value => value * (options.queryScale ?? 1)));
            keys = latent.map((value, index) => [...matvec(projection(2, 2, seed + 800 + head * 17), value), ...rotaryK[index]]);
            values = latent.map(value => matvec(projection(3, 2, seed + 900 + head * 17), value) as Vector3);
        } else {
            queries = queryInputs.map(input => matvec(projection(3, 3, seed + head * 17), input).map(value => value * (options.queryScale ?? 1)));
            keys = keyInputs.map(input => matvec(projection(3, 3, seed + 100 + group * 17), input));
            values = keyInputs.map(input => matvec(projection(3, 3, seed + 200 + group * 17), input) as Vector3);
            if (encoding === 'rope') {
                queries = queries.map((query, index) => rotatePairs(query, index + offset));
                keys = keys.map((key, index) => rotatePairs(key, index + (options.keyInputs ? 0 : offset)));
            }
        }
        const scores = queries.map((query, i) => keys.map((key, j) => permitted(i, j, keys.length, options) ? dot(query, key) / Math.sqrt(query.length) : -Infinity));
        const weights = scores.map(softmax);
        const outputs = weights.map(row => [0, 1, 2].map(axis => row.reduce((sum, weight, index) => sum + weight * values[index][axis], 0)) as Vector3);
        traces.push({ queries, keys, values, scores, weights, outputs, group });
    }
    const outputMatrix = projection(3, heads * 3, seed + 300);
    const outputs = inputs.map((_, index) => matvec(outputMatrix, traces.flatMap(head => head.outputs[index])) as Vector3);
    return { inputs: inputs.map(input => [...input]), heads: traces, outputs };
}

export interface DecodeTrace {
    outputs: Vector3[];
    groups: Array<{ keys: number[][]; values: Vector3[] }>;
    latents: number[][];
    rotaryKeys: number[][];
    retainedElements: number;
}
/** Retain unique K/V groups, or MLA content latents plus separate rotary keys. */
export function cachedDecodeTrace(inputs: readonly Vector3[], options: AttentionOptions = {}): DecodeTrace {
    const heads = options.heads ?? 2; const layout = options.kvLayout ?? 'mha'; const seed = options.seed ?? 3610;
    const groups: Array<{ keys: number[][]; values: Vector3[] }> = Array.from({ length: layout === 'mla' ? 0 : kvGroups(heads,layout) }, () => ({ keys: [], values: [] }));
    const latents: number[][] = []; const rotaryKeys: number[][] = [];
    const outputMatrix = projection(3, heads * 3, seed + 300);
    const outputs: Vector3[] = [];
    for (let time = 0; time < inputs.length; time++) {
        // Only this token is projected. Position offsets preserve its absolute index.
        const current = runAttention([inputs[time]], { ...options, mask: 'bidirectional', padding: 0, offset: (options.offset ?? 0) + time });
        if (layout === 'mla') {
            const positioned = positionInput(inputs[time],time + (options.offset ?? 0),options.position ?? 'none');
            latents.push(matvec(projection(2,3,seed + 500),positioned));
            rotaryKeys.push(rotatePairs(matvec(projection(2,3,seed + 750),positioned),time + (options.offset ?? 0)));
        } else {
            for (let group = 0; group < groups.length; group++) {
                const head = current.heads.find(trace => trace.group === group)!;
                groups[group].keys.push(head.keys[0]); groups[group].values.push(head.values[0]);
            }
        }
        const headOutputs = current.heads.flatMap((head, index) => {
            // MLA reconstructs expanded per-head rows transiently; it does not retain them.
            const keys = layout === 'mla' ? latents.map((latent,i) => [...matvec(projection(2,2,seed + 800 + index * 17),latent),...rotaryKeys[i]]) : groups[head.group].keys;
            const values = layout === 'mla' ? latents.map(latent => matvec(projection(3,2,seed + 900 + index * 17),latent) as Vector3) : groups[head.group].values;
            const weights = softmax(keys.map(key => dot(head.queries[0], key) / Math.sqrt(head.queries[0].length)));
            return [0,1,2].map(axis => weights.reduce((sum, weight, key) => sum + weight * values[key][axis], 0));
        });
        outputs.push(matvec(outputMatrix, headOutputs) as Vector3);
    }
    const retainedElements = groups.reduce((sum,group) => sum + group.keys.flat().length + group.values.flat().length,0) + latents.flat().length + rotaryKeys.flat().length;
    return {outputs,groups,latents,rotaryKeys,retainedElements};
}
export const cachedDecode = (inputs: readonly Vector3[], options: AttentionOptions = {}): Vector3[] => cachedDecodeTrace(inputs,options).outputs;

export function combineHeadOutputs(outputs: readonly Vector3[], seed = 3610): Vector3 {
    return matvec(projection(3,outputs.length * 3,seed + 300),outputs.flat()) as Vector3;
}

export function layerNorm(vector: Vector3): Vector3 {
    const mean = vector.reduce((sum, value) => sum + value, 0) / 3;
    const variance = vector.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 3;
    return vector.map(value => (value - mean) / Math.sqrt(variance + 1e-5)) as Vector3;
}
export function feedForward(vector: Vector3, seed = 3610, activation: 'relu' | 'gelu' | 'swiglu' = 'gelu'): Vector3 {
    const hidden = matvec(projection(6, 3, seed + 1000), vector);
    const gate = matvec(projection(6, 3, seed + 1100), vector);
    const activated = hidden.map((value, index) => activation === 'relu' ? Math.max(0, value)
        : activation === 'swiglu' ? value / (1 + Math.exp(-value)) * gate[index]
            : 0.5 * value * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (value + 0.044715 * value ** 3))));
    return matvec(projection(3, 6, seed + 1200), activated) as Vector3;
}
export interface BlockTrace { input: Vector3[]; attention: Vector3[]; residual: Vector3[]; normalized: Vector3[]; feedForward: Vector3[]; output: Vector3[]; }
export function transformerBlock(inputs: readonly Vector3[], options: AttentionOptions = {}, normalization: 'pre' | 'post' = 'pre', activation: 'relu' | 'gelu' | 'swiglu' = 'gelu'): BlockTrace {
    const input = inputs.map(vector => [...vector] as Vector3);
    const attention = runAttention(normalization === 'pre' ? input.map(layerNorm) : input, options).outputs;
    const residual = input.map((vector, index) => add3(vector, attention[index]));
    const normalized = residual.map(layerNorm);
    const ff = normalized.map(vector => feedForward(vector, options.seed, activation));
    const output = normalization === 'pre' ? residual.map((vector, index) => add3(vector, ff[index])) : normalized.map((vector, index) => layerNorm(add3(vector, ff[index])));
    return { input, attention, residual, normalized, feedForward: ff, output };
}

export interface LinearAttentionTrace { outputs: Vector3[]; weights: number[][]; states: number[][][]; normalizers: number[][]; }
/** Positive-feature kernel attention: causal recurrence and explicit kernel weights agree. */
export function linearAttention(head: HeadTrace, causal = true): LinearAttentionTrace {
    const phi = (vector: readonly number[]) => vector.map(value => value >= 0 ? value + 1 : Math.exp(value));
    const queries = head.queries.map(phi); const keys = head.keys.map(phi); const dimension = keys[0]?.length ?? 3;
    const outputs: Vector3[] = []; const states: number[][][] = []; const normalizers: number[][] = []; const weights: number[][] = [];
    let state = Array.from({ length: dimension }, () => [0, 0, 0]); let normalizer = Array<number>(dimension).fill(0);
    if (!causal) head.keys.forEach((_, time) => {
        state = state.map((row, d) => row.map((value, axis) => value + keys[time][d] * head.values[time][axis]));
        normalizer = normalizer.map((value, d) => value + keys[time][d]);
    });
    for (let time = 0; time < queries.length; time++) {
        if (causal) {
            state = state.map((row, d) => row.map((value, axis) => value + keys[time][d] * head.values[time][axis]));
            normalizer = normalizer.map((value, d) => value + keys[time][d]);
        }
        const denominator = dot(queries[time], normalizer);
        outputs.push([0,1,2].map(axis => state.reduce((sum, row, d) => sum + queries[time][d] * row[axis], 0) / Math.max(1e-12, denominator)) as Vector3);
        const unnormalized = keys.map((key, index) => causal && index > time ? 0 : dot(queries[time], key));
        const total = unnormalized.reduce((sum, value) => sum + value, 0);
        weights.push(unnormalized.map(value => value / total)); states.push(state.map(row => [...row])); normalizers.push([...normalizer]);
    }
    return { outputs, weights, states, normalizers };
}

/** Stable online-softmax accumulation computes exact attention without a full score row. */
export interface AttentionTile { maximum: number; denominator: number; accumulator: Vector3; output: Vector3; processed: number; }
export function tiledAttentionTrace(scores: readonly number[], values: readonly Vector3[], tileSize: number): AttentionTile[] {
    if (!Number.isInteger(tileSize) || tileSize < 1) throw new RangeError('Tile size must be a positive integer.');
    let maximum = -Infinity; let denominator = 0; let accumulator: Vector3 = [0,0,0];
    const frames: AttentionTile[] = [];
    for (let start = 0; start < scores.length; start += tileSize) {
        const block = scores.slice(start, start + tileSize); const nextMaximum = Math.max(maximum, ...block);
        if (nextMaximum === -Infinity) { frames.push({maximum,denominator,accumulator:[...accumulator],output:[0,0,0],processed:Math.min(start + tileSize,scores.length)}); continue; }
        const correction = maximum === -Infinity ? 0 : Math.exp(maximum - nextMaximum);
        accumulator = scale3(accumulator, correction); denominator *= correction;
        block.forEach((score, offset) => {
            const weight = score === -Infinity ? 0 : Math.exp(score - nextMaximum);
            accumulator = add3(accumulator, scale3(values[start + offset], weight)); denominator += weight;
        });
        maximum = nextMaximum;
        frames.push({maximum,denominator,accumulator:[...accumulator],output:scale3(accumulator,1 / denominator),processed:Math.min(start + tileSize,scores.length)});
    }
    return frames;
}
export const tiledAttention = (scores: readonly number[], values: readonly Vector3[], tileSize: number): Vector3 => tiledAttentionTrace(scores,values,tileSize).at(-1)?.output ?? [0,0,0];

export interface ExpertTrace { probabilities: number[][]; routes: Array<Array<{ expert: number; weight: number; accepted: boolean }>>; outputs: Vector3[]; loads: number[]; capacity: number; dropped: number; }
export function routeExperts(inputs: readonly Vector3[], topK: number, capacityFactor: number, seed = 3610): ExpertTrace {
    const experts = 3; const router = projection(experts, 3, seed + 1300);
    const probabilities = inputs.map(input => softmax(matvec(router, input)));
    const loads = [0,0,0]; const capacity = Math.max(1, Math.ceil(capacityFactor * inputs.length * topK / experts)); let dropped = 0;
    const routes = probabilities.map(row => {
        const selected = row.map((value, expert) => ({ value, expert })).sort((a,b) => b.value - a.value).slice(0, topK);
        const total = selected.reduce((sum, item) => sum + item.value, 0);
        return selected.map(item => {
            const accepted = loads[item.expert] < capacity;
            if (accepted) loads[item.expert]++; else dropped++;
            return { expert: item.expert, weight: item.value / total, accepted };
        });
    });
    const outputs = inputs.map((input, time) => routes[time].reduce<Vector3>((sum, route) => route.accepted
        ? add3(sum, scale3(feedForward(input, seed + route.expert * 151), route.weight)) : sum, [0,0,0]));
    return { probabilities, routes, outputs, loads, capacity, dropped };
}

export function imagePatches(size: 2 | 4, pattern: 'stripes' | 'checker' | 'diagonal') {
    const pixels = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, column) => pattern === 'stripes' ? (column % 4 < 2 ? 1 : 0.1) : pattern === 'checker' ? ((Math.floor(row / 2) + Math.floor(column / 2)) % 2 ? 0.1 : 1) : Math.max(0, 1 - Math.abs(row - column) / 4)));
    const patches: Array<{ vector: Vector3; row: number; column: number }> = [];
    for (let row = 0; row < 8; row += size) for (let column = 0; column < 8; column += size) {
        let mean = 0; let horizontal = 0; let vertical = 0;
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
            const value = pixels[row + r][column + c]; mean += value; horizontal += value * (c < size / 2 ? -1 : 1); vertical += value * (r < size / 2 ? -1 : 1);
        }
        patches.push({ vector: [mean / size ** 2, horizontal / size ** 2, vertical / size ** 2], row, column });
    }
    return { pixels, patches };
}

export const DEMO_TOKENS = ['cue', 'a', 'b', 'noise', 'a', 'read'];
export const DEMO_EMBEDDINGS: readonly Vector3[] = [[1,0.2,-0.1],[0.2,1,0.1],[-0.4,0.2,1],[0.1,-0.8,0.2],[0.2,1,0.1],[0.8,0.1,-0.5]];
