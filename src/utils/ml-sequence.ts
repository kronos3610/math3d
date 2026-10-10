/** Small, fully computed sequence models. Weights are demonstration parameters, not pretrained models. */
export type State3 = [number, number, number];
export type Matrix3 = [State3, State3, State3];
const zero = (): State3 => [0, 0, 0];
const zeros = (): Matrix3 => [zero(), zero(), zero()];
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const map3 = (fn: (index: number) => number): State3 => [fn(0), fn(1), fn(2)];
const sigmoid = (value: number) => value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
const norm = (values: readonly number[]) => Math.hypot(...values);

export interface HiddenMarkovModel {
    initial: State3;
    /** Rows are previous states; columns are next states. */
    transition: Matrix3;
    /** Rows are states; columns are categorical observations. */
    emission: Matrix3;
}

export interface HMMResult {
    filtered: State3[];
    predicted: State3[];
    scales: number[];
    logLikelihood: number;
    possible: boolean;
}

function checkDistribution(values: readonly number[]) {
    if (values.some(value => !Number.isFinite(value) || value < 0) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) {
        throw new Error('HMM distributions must be finite, nonnegative, and sum to one.');
    }
}

function checkHMM(model: HiddenMarkovModel, observations: readonly number[]) {
    [model.initial, ...model.transition, ...model.emission].forEach(checkDistribution);
    if (observations.some(value => !Number.isInteger(value) || value < 0 || value > 2)) throw new Error('Observations must be category 0, 1, or 2.');
}

export function createDemoHMM(persistence = 0.8): HiddenMarkovModel {
    if (persistence < 0 || persistence > 1) throw new Error('Persistence must be between zero and one.');
    return {
        initial: [0.5, 0.3, 0.2],
        transition: [0, 1, 2].map(i => map3(j => i === j ? persistence : (1 - persistence) / 2)) as Matrix3,
        emission: [[0.75, 0.2, 0.05], [0.15, 0.7, 0.15], [0.05, 0.25, 0.7]],
    };
}

/** Scaling at each step avoids multiplying many tiny probabilities. */
export function filterHMM(model: HiddenMarkovModel, observations: readonly number[]): HMMResult {
    checkHMM(model, observations);
    const filtered: State3[] = [];
    const predicted: State3[] = [];
    const scales: number[] = [];
    let logLikelihood = 0;
    for (const [time, observation] of observations.entries()) {
        const prediction = time === 0 ? [...model.initial] as State3 : map3(j => filtered[time - 1].reduce((sum, value, i) => sum + value * model.transition[i][j], 0));
        const weighted = map3(j => prediction[j] * model.emission[j][observation]);
        const scale = weighted.reduce((sum, value) => sum + value, 0);
        predicted.push(prediction);
        scales.push(scale);
        if (scale === 0) return { filtered, predicted, scales, logLikelihood: -Infinity, possible: false };
        filtered.push(map3(j => weighted[j] / scale));
        logLikelihood += Math.log(scale);
    }
    return { filtered, predicted, scales, logLikelihood, possible: true };
}

export interface ViterbiResult { path: number[]; logProbability: number; }
export function viterbiHMM(model: HiddenMarkovModel, observations: readonly number[]): ViterbiResult {
    checkHMM(model, observations);
    if (observations.length === 0) return { path: [], logProbability: 0 };
    let scores = map3(i => Math.log(model.initial[i]) + Math.log(model.emission[i][observations[0]]));
    const back: number[][] = [];
    for (let time = 1; time < observations.length; time++) {
        const previous = scores;
        const pointers: number[] = [];
        scores = map3(j => {
            const candidates = map3(i => previous[i] + Math.log(model.transition[i][j]));
            const best = candidates.indexOf(Math.max(...candidates));
            pointers[j] = best;
            return candidates[best] + Math.log(model.emission[j][observations[time]]);
        });
        back.push(pointers);
    }
    const logProbability = Math.max(...scores);
    if (logProbability === -Infinity) return { path: [], logProbability };
    const path = [scores.indexOf(logProbability)];
    for (let time = back.length - 1; time >= 0; time--) path.unshift(back[time][path[0]]);
    return { path, logProbability };
}

/** One maximum-likelihood Baum–Welch update for this one observed sequence; no fabricated hidden labels. */
export function baumWelchStep(model: HiddenMarkovModel, observations: readonly number[]): HiddenMarkovModel {
    const forward = filterHMM(model, observations);
    if (!forward.possible || observations.length === 0) return model;
    const count = observations.length;
    const backward: State3[] = Array.from({ length: count }, () => [1, 1, 1]);
    for (let time = count - 2; time >= 0; time--) {
        backward[time] = map3(i => model.transition[i].reduce((sum, value, j) => sum + value * model.emission[j][observations[time + 1]] * backward[time + 1][j], 0) / forward.scales[time + 1]);
    }
    const gamma = forward.filtered.map((alpha, time) => {
        const values = map3(i => alpha[i] * backward[time][i]);
        const total = values.reduce((sum, value) => sum + value, 0);
        return map3(i => values[i] / total);
    });
    const transitions = zeros();
    for (let time = 0; time < count - 1; time++) {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            transitions[i][j] += forward.filtered[time][i] * model.transition[i][j] * model.emission[j][observations[time + 1]] * backward[time + 1][j] / forward.scales[time + 1];
        }
    }
    const normalizeOr = (values: State3, fallback: State3) => {
        const total = values.reduce((sum, value) => sum + value, 0);
        return total > 0 ? map3(i => values[i] / total) : [...fallback] as State3;
    };
    return {
        initial: gamma[0],
        transition: transitions.map((row, i) => normalizeOr(row, model.transition[i])) as Matrix3,
        emission: [0, 1, 2].map(i => normalizeOr(map3(category => gamma.reduce((sum, row, time) => sum + (observations[time] === category ? row[i] : 0), 0)), model.emission[i])) as Matrix3,
    };
}

export interface RecurrentWeights { input: State3; recurrent: Matrix3; bias: State3; output: State3; outputBias: number; }
export interface GateWeights { input: State3; recurrent: Matrix3; bias: State3; }
export interface LSTMWeights { input: GateWeights; forget: GateWeights; output: GateWeights; candidate: GateWeights; }
export interface GRUWeights { update: GateWeights; reset: GateWeights; candidate: GateWeights; }
export interface SequenceStep { input: number; hidden: State3; cell?: State3; gates?: Record<string, State3>; }
const affine = (weights: GateWeights, input: number, hidden: State3) => map3(i => weights.input[i] * input + dot(weights.recurrent[i], hidden) + weights.bias[i]);

export function createRNNWeights(recurrentScale = 0.9): RecurrentWeights {
    return {
        input: [0.8, -0.55, 0.4],
        recurrent: [[recurrentScale, 0.08, 0], [0, recurrentScale * 0.85, -0.08], [0.06, 0, recurrentScale * 0.7]],
        bias: [0, 0, 0], output: [0.8, -0.55, 0.35], outputBias: 0,
    };
}

function demoGate(bias: State3, strength = 0.2): GateWeights {
    return { input: [strength, -strength * 0.7, strength * 0.5], recurrent: [[0.1, 0, 0], [0, 0.1, 0], [0, 0, 0.1]], bias };
}
export function createLSTMWeights(forgetBias = 1.5, inputBias = 0.25, outputBias = 1): LSTMWeights {
    return { input: demoGate([inputBias, inputBias, inputBias]), forget: demoGate([forgetBias, forgetBias, forgetBias]), output: demoGate([outputBias, outputBias, outputBias]), candidate: demoGate([0, 0, 0], 1) };
}
export function createGRUWeights(retainBias = 1.5, resetBias = 0): GRUWeights {
    const candidate = demoGate([0, 0, 0], 1);
    candidate.recurrent = [[0.9, 0.12, 0], [0.05, 0.75, -0.08], [0.08, 0, 0.65]];
    return { update: demoGate([retainBias, retainBias, retainBias]), reset: demoGate([resetBias, resetBias, resetBias]), candidate };
}
export function runRNN(inputs: readonly number[], weights: RecurrentWeights): SequenceStep[] {
    let hidden = zero();
    return inputs.map(input => {
        const preactivation = affine(weights, input, hidden);
        hidden = map3(i => Math.tanh(preactivation[i]));
        return { input, hidden };
    });
}
export function runLSTM(inputs: readonly number[], weights: LSTMWeights): SequenceStep[] {
    let hidden = zero();
    let cell = zero();
    return inputs.map(input => {
        const i = affine(weights.input, input, hidden).map(sigmoid) as State3;
        const f = affine(weights.forget, input, hidden).map(sigmoid) as State3;
        const o = affine(weights.output, input, hidden).map(sigmoid) as State3;
        const g = affine(weights.candidate, input, hidden).map(Math.tanh) as State3;
        cell = map3(j => f[j] * cell[j] + i[j] * g[j]);
        hidden = map3(j => o[j] * Math.tanh(cell[j]));
        return { input, hidden, cell, gates: { input: i, forget: f, output: o, candidate: g } };
    });
}
/** Convention: z retains the old state. The reset gate multiplies h before the candidate's recurrent matrix. */
export function runGRU(inputs: readonly number[], weights: GRUWeights): SequenceStep[] {
    let hidden = zero();
    return inputs.map(input => {
        const z = affine(weights.update, input, hidden).map(sigmoid) as State3;
        const r = affine(weights.reset, input, hidden).map(sigmoid) as State3;
        const resetHidden = map3(i => r[i] * hidden[i]);
        const candidate = affine(weights.candidate, input, resetHidden).map(Math.tanh) as State3;
        hidden = map3(i => z[i] * hidden[i] + (1 - z[i]) * candidate[i]);
        return { input, hidden, gates: { retain: z, reset: r, candidate } };
    });
}

export interface GateContributions { retained: State3; written: State3; combined: State3; exposed: State3; }
/** Componentwise contributions at a revealed time, in the same three state coordinates. */
export function gateContributions(mode: 'lstm' | 'gru', steps: readonly SequenceStep[], index: number): GateContributions {
    if (index < 0) return { retained: zero(), written: zero(), combined: zero(), exposed: zero() };
    const current = steps[index];
    if (!current?.gates) throw new Error('Gate contributions need a computed gated sequence step.');
    const previous = mode === 'lstm' ? steps[index - 1]?.cell ?? zero() : steps[index - 1]?.hidden ?? zero();
    const retained = map3(i => (mode === 'lstm' ? current.gates!.forget[i] : current.gates!.retain[i]) * previous[i]);
    const written = map3(i => (mode === 'lstm' ? current.gates!.input[i] : 1 - current.gates!.retain[i]) * current.gates!.candidate[i]);
    return { retained, written, combined: map3(i => retained[i] + written[i]), exposed: current.hidden };
}

export function cueSequence(length: number, cue = 1, distractors = false): number[] {
    return Array.from({ length: Math.max(1, Math.round(length)) }, (_, i) => i === 0 ? cue : distractors ? 0.3 * Math.sin(i * 2.1) : 0);
}
export function rnnPrediction(steps: readonly SequenceStep[], weights: RecurrentWeights): number {
    return dot(weights.output, steps.at(-1)?.hidden ?? zero()) + weights.outputBias;
}

/** Fixed ordering makes finite-difference checks and global gradient clipping unambiguous. */
export function packRNN(weights: RecurrentWeights): number[] {
    return [...weights.input, ...weights.recurrent.flat(), ...weights.bias, ...weights.output, weights.outputBias];
}
export function unpackRNN(values: readonly number[]): RecurrentWeights {
    if (values.length !== 19) throw new Error('A three-state RNN has 19 parameters.');
    return { input: values.slice(0, 3) as State3, recurrent: [values.slice(3, 6), values.slice(6, 9), values.slice(9, 12)] as Matrix3, bias: values.slice(12, 15) as State3, output: values.slice(15, 18) as State3, outputBias: values[18] };
}
export interface BPTTResult { steps: SequenceStep[]; prediction: number; loss: number; gradient: number[]; stateGradientNorms: number[]; }
/** Exact reverse-mode derivative of 1/2 (final prediction − target)^2; truncation detaches earlier states. */
export function rnnBPTT(inputs: readonly number[], target: number, weights: RecurrentWeights, window = inputs.length): BPTTResult {
    const steps = runRNN(inputs, weights);
    const prediction = rnnPrediction(steps, weights);
    const error = prediction - target;
    const gradientWeights: RecurrentWeights = { input: zero(), recurrent: zeros(), bias: zero(), output: zero(), outputBias: error };
    const last = steps.at(-1)?.hidden ?? zero();
    gradientWeights.output = map3(i => error * last[i]);
    let hiddenGradient = map3(i => error * weights.output[i]);
    const stateGradientNorms = Array.from({ length: inputs.length }, () => 0);
    const start = Math.max(0, inputs.length - Math.max(0, Math.floor(window)));
    for (let time = inputs.length - 1; time >= start; time--) {
        stateGradientNorms[time] = norm(hiddenGradient);
        const state = steps[time].hidden;
        const previous = steps[time - 1]?.hidden ?? zero();
        const delta = map3(i => hiddenGradient[i] * (1 - state[i] * state[i]));
        for (let i = 0; i < 3; i++) {
            gradientWeights.input[i] += delta[i] * inputs[time];
            gradientWeights.bias[i] += delta[i];
            for (let j = 0; j < 3; j++) gradientWeights.recurrent[i][j] += delta[i] * previous[j];
        }
        hiddenGradient = map3(j => delta.reduce((sum, value, i) => sum + value * weights.recurrent[i][j], 0));
    }
    return { steps, prediction, loss: error * error / 2, gradient: packRNN(gradientWeights), stateGradientNorms };
}
export function finiteDifferenceGradient(values: readonly number[], loss: (parameters: number[]) => number, epsilon: number | ((index: number) => number) = 1e-5): number[] {
    return values.map((_, index) => {
        const plus = [...values]; const minus = [...values];
        const perturbation = typeof epsilon === 'number' ? epsilon : epsilon(index);
        if (!(perturbation > 0)) throw new Error('Finite-difference perturbation must be positive.');
        plus[index] += perturbation; minus[index] -= perturbation;
        return (loss(plus) - loss(minus)) / (2 * perturbation);
    });
}
export function clipGradient(gradient: readonly number[], limit: number): { gradient: number[]; norm: number; scale: number } {
    if (!(limit > 0)) throw new Error('Clipping limit must be positive.');
    const magnitude = norm(gradient);
    const scale = magnitude > limit ? limit / magnitude : 1;
    return { gradient: gradient.map(value => value * scale), norm: magnitude, scale };
}
export function trainCueRNN(weights: RecurrentWeights, length: number, iterations = 100, learningRate = 0.08): RecurrentWeights {
    let values = packRNN(weights);
    for (let iteration = 0; iteration < iterations; iteration++) {
        const model = unpackRNN(values);
        const examples = [-1, 1].map(cue => rnnBPTT(cueSequence(length, cue), cue, model).gradient);
        const average = values.map((_, i) => (examples[0][i] + examples[1][i]) / 2);
        const clipped = clipGradient(average, 1).gradient;
        values = values.map((value, i) => value - learningRate * clipped[i]);
    }
    return unpackRNN(values);
}

export interface FeedforwardWeights { hidden: [[number, number], [number, number], [number, number]]; hiddenBias: State3; output: State3; outputBias: number; }
export interface FeedforwardResult { hidden: State3; logit: number; probability: number; }
export interface TrainingExample { input: [number, number]; target: number; }
export const XOR_EXAMPLES: readonly TrainingExample[] = [
    { input: [-1, -1], target: 0 }, { input: [-1, 1], target: 1 }, { input: [1, -1], target: 1 }, { input: [1, 1], target: 0 },
];
export function createFeedforwardWeights(): FeedforwardWeights {
    return { hidden: [[0.8, 0.6], [-0.9, -0.5], [0.4, -0.7]], hiddenBias: [-0.5, -0.4, 0.1], output: [-0.4, -0.6, 0.3], outputBias: 0.1 };
}
export function feedforward(input: readonly [number, number], weights: FeedforwardWeights): FeedforwardResult {
    const hidden = map3(i => Math.tanh(dot(weights.hidden[i], input) + weights.hiddenBias[i]));
    const logit = dot(weights.output, hidden) + weights.outputBias;
    return { hidden, logit, probability: sigmoid(logit) };
}
export function packFeedforward(weights: FeedforwardWeights): number[] { return [...weights.hidden.flat(), ...weights.hiddenBias, ...weights.output, weights.outputBias]; }
export function unpackFeedforward(values: readonly number[]): FeedforwardWeights {
    if (values.length !== 13) throw new Error('This feedforward network has 13 parameters.');
    return { hidden: [values.slice(0, 2), values.slice(2, 4), values.slice(4, 6)] as FeedforwardWeights['hidden'], hiddenBias: values.slice(6, 9) as State3, output: values.slice(9, 12) as State3, outputBias: values[12] };
}
export function feedforwardGradient(weights: FeedforwardWeights, examples: readonly TrainingExample[] = XOR_EXAMPLES): { loss: number; gradient: number[] } {
    if (examples.length === 0) throw new Error('Training requires at least one example.');
    const gradient = Array.from({ length: 13 }, () => 0);
    let loss = 0;
    for (const { input, target } of examples) {
        const result = feedforward(input, weights);
        // Stable binary cross entropy from the logit, avoiding log(0).
        loss += Math.max(result.logit, 0) - result.logit * target + Math.log1p(Math.exp(-Math.abs(result.logit)));
        const outputDelta = result.probability - target;
        for (let i = 0; i < 3; i++) {
            const hiddenDelta = outputDelta * weights.output[i] * (1 - result.hidden[i] ** 2);
            gradient[2 * i] += hiddenDelta * input[0];
            gradient[2 * i + 1] += hiddenDelta * input[1];
            gradient[6 + i] += hiddenDelta;
            gradient[9 + i] += outputDelta * result.hidden[i];
        }
        gradient[12] += outputDelta;
    }
    return { loss: loss / examples.length, gradient: gradient.map(value => value / examples.length) };
}
export function trainFeedforward(weights: FeedforwardWeights, iterations = 200, learningRate = 0.3): FeedforwardWeights {
    let values = packFeedforward(weights);
    for (let iteration = 0; iteration < iterations; iteration++) {
        const { gradient } = feedforwardGradient(unpackFeedforward(values));
        values = values.map((value, i) => value - learningRate * gradient[i]);
    }
    return unpackFeedforward(values);
}
