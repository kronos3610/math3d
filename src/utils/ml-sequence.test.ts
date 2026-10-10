import { describe, expect, test } from 'vitest';
import {
    baumWelchStep, clipGradient, createDemoHMM, createFeedforwardWeights, createGRUWeights,
    createLSTMWeights, createRNNWeights, cueSequence, feedforward, feedforwardGradient,
    filterHMM, finiteDifferenceGradient, gateContributions, packFeedforward, packRNN, rnnBPTT,
    runGRU, runLSTM, trainCueRNN, trainFeedforward, unpackFeedforward, unpackRNN,
    viterbiHMM, XOR_EXAMPLES,
} from './ml-sequence';

describe('categorical HMM inference and learning', () => {
    test('scaled filtering and Viterbi agree with independent exhaustive paths', () => {
        const model = createDemoHMM(0.73);
        const observations = [0, 2, 1, 1];
        const filtering = filterHMM(model, observations);
        let evidence = 0; let bestProbability = -1; let bestPath: number[] = [];
        const finalMass = [0, 0, 0];
        for (let code = 0; code < 3 ** observations.length; code++) {
            let remaining = code;
            const path = observations.map(() => { const state = remaining % 3; remaining = Math.floor(remaining / 3); return state; });
            let probability = model.initial[path[0]] * model.emission[path[0]][observations[0]];
            for (let t = 1; t < path.length; t++) probability *= model.transition[path[t - 1]][path[t]] * model.emission[path[t]][observations[t]];
            evidence += probability; finalMass[path.at(-1)!] += probability;
            if (probability > bestProbability) { bestProbability = probability; bestPath = path; }
        }
        expect(Math.exp(filtering.logLikelihood)).toBeCloseTo(evidence, 12);
        filtering.filtered.forEach(row => expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12));
        filtering.filtered.at(-1)!.forEach((value, i) => expect(value).toBeCloseTo(finalMass[i] / evidence, 12));
        expect(viterbiHMM(model, observations).path).toEqual(bestPath);
        expect(Math.exp(viterbiHMM(model, observations).logProbability)).toBeCloseTo(bestProbability, 12);
    });
    test('Baum–Welch raises observed likelihood and keeps every distribution normalized', () => {
        let model = createDemoHMM();
        const observations = [0, 0, 1, 1, 2, 2, 2, 1, 0, 0];
        for (let update = 0; update < 4; update++) {
            const previous = filterHMM(model, observations).logLikelihood;
            model = baumWelchStep(model, observations);
            expect(filterHMM(model, observations).logLikelihood).toBeGreaterThanOrEqual(previous - 1e-10);
            [model.initial, ...model.transition, ...model.emission].forEach(row => {
                expect(row.every(value => value >= 0 && Number.isFinite(value))).toBe(true);
                expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
            });
        }
    });
    test('impossible observations remain explicitly undefined rather than inventing a posterior', () => {
        const model = createDemoHMM();
        model.emission = [[1, 0, 0], [1, 0, 0], [1, 0, 0]];
        expect(filterHMM(model, [2]).possible).toBe(false);
        expect(filterHMM(model, [2]).logLikelihood).toBe(-Infinity);
        expect(viterbiHMM(model, [2]).path).toEqual([]);
        expect(() => filterHMM(createDemoHMM(), [3])).toThrow();
    });
});

describe('real gated recurrences and BPTT', () => {
    test('LSTM cell and visible hidden state obey the computed gates at every time', () => {
        const steps = runLSTM([1, 0.2, -0.4, 0], createLSTMWeights());
        steps.forEach((step, time) => {
            for (let i = 0; i < 3; i++) {
                const previous = steps[time - 1]?.cell?.[i] ?? 0;
                expect(step.cell![i]).toBeCloseTo(step.gates!.forget[i] * previous + step.gates!.input[i] * step.gates!.candidate[i], 12);
                expect(step.hidden[i]).toBeCloseTo(step.gates!.output[i] * Math.tanh(step.cell![i]), 12);
            }
        });
    });
    test('GRU update convention really retains old state; reset is used in the candidate', () => {
        const weights = createGRUWeights();
        const steps = runGRU([1, -0.4, 0.2], weights);
        steps.forEach((step, time) => {
            const previous = steps[time - 1]?.hidden ?? [0, 0, 0];
            for (let i = 0; i < 3; i++) {
                const reset = previous.map((h, j) => h * step.gates!.reset[j]);
                const candidate = Math.tanh(weights.candidate.input[i] * step.input + weights.candidate.bias[i] + weights.candidate.recurrent[i].reduce((sum, w, j) => sum + w * reset[j], 0));
                expect(step.hidden[i]).toBeCloseTo(step.gates!.retain[i] * previous[i] + (1 - step.gates!.retain[i]) * candidate, 12);
            }
        });
    });
    test('gate contributions sum to actual memory/state and independently controlled gates change the right terms', () => {
        for (const mode of ['lstm', 'gru'] as const) {
            const steps = mode === 'lstm' ? runLSTM([1, 0, -0.2], createLSTMWeights()) : runGRU([1, 0, -0.2], createGRUWeights());
            steps.forEach((row, index) => {
                const contributions = gateContributions(mode, steps, index);
                expect(contributions.exposed).toEqual(row.hidden);
                for (let dimension = 0; dimension < 3; dimension++) {
                    expect(contributions.retained[dimension] + contributions.written[dimension]).toBeCloseTo((mode === 'lstm' ? row.cell! : row.hidden)[dimension], 12);
                }
            });
        }
        const open = runLSTM([1], createLSTMWeights(1.5, 3, 5))[0];
        const hiddenOutput = runLSTM([1], createLSTMWeights(1.5, 3, -5))[0];
        expect(hiddenOutput.cell).toEqual(open.cell);
        expect(Math.hypot(...hiddenOutput.hidden)).toBeLessThan(Math.hypot(...open.hidden) / 50);
        const blockedWrite = runLSTM([1], createLSTMWeights(1.5, -5, 5))[0];
        expect(Math.hypot(...blockedWrite.cell!)).toBeLessThan(Math.hypot(...open.cell!) / 50);
        const resetOpen = runGRU([1, 0], createGRUWeights(1.5, 5));
        const resetClosed = runGRU([1, 0], createGRUWeights(1.5, -5));
        expect(resetOpen[0].hidden).toEqual(resetClosed[0].hidden);
        expect(resetOpen[1].gates!.candidate).not.toEqual(resetClosed[1].gates!.candidate);
    });
    test('all nineteen shared RNN parameter derivatives match central finite differences', () => {
        const weights = createRNNWeights(1.1);
        weights.bias = [0.1, -0.2, 0.05];
        const inputs = [0.7, -0.2, 0.4, 0.1];
        const analytic = rnnBPTT(inputs, 0.6, weights);
        const numerical = finiteDifferenceGradient(packRNN(weights), values => rnnBPTT(inputs, 0.6, unpackRNN(values)).loss);
        analytic.gradient.forEach((value, i) => expect(value).toBeCloseTo(numerical[i], 7));
    });
    test('truncation detaches old states without changing predictions and clipping only rescales gradients', () => {
        const inputs = cueSequence(8);
        const weights = createRNNWeights();
        const full = rnnBPTT(inputs, 1, weights);
        const truncated = rnnBPTT(inputs, 1, weights, 2);
        expect(truncated.steps).toEqual(full.steps);
        expect(truncated.prediction).toBe(full.prediction);
        expect(truncated.stateGradientNorms.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
        expect(truncated.gradient).not.toEqual(full.gradient);
        const clipped = clipGradient([3, 4], 2);
        expect(clipped.norm).toBe(5);
        expect(clipped.scale).toBe(0.4);
        expect(clipped.gradient[0]).toBeCloseTo(1.2, 12);
        expect(clipped.gradient[1]).toBeCloseTo(1.6, 12);
        expect(Math.hypot(...clipped.gradient)).toBeCloseTo(2, 12);
    });
    test('adaptive finite differences remain useful when an unsaturated recurrence amplifies the gradient', () => {
        const weights = createRNNWeights(2);
        const inputs = cueSequence(32, 0);
        const full = rnnBPTT(inputs, 1, weights);
        const numerical = finiteDifferenceGradient(packRNN(weights), values => rnnBPTT(inputs, 1, unpackRNN(values)).loss,
            index => 1e-5 / Math.max(1, Math.abs(full.gradient[index])));
        expect(Math.max(...full.gradient.map(Math.abs))).toBeGreaterThan(1e6);
        full.gradient.forEach((value, i) => {
            const scaledError = Math.abs(value - numerical[i]) / Math.max(1, Math.abs(value), Math.abs(numerical[i]));
            expect(scaledError).toBeLessThan(1e-6);
        });
    });
    test('actual cue-task SGD reduces measured loss on both cue signs', () => {
        const initial = createRNNWeights();
        const trained = trainCueRNN(initial, 6, 120);
        for (const cue of [-1, 1]) {
            expect(rnnBPTT(cueSequence(6, cue), cue, trained).loss).toBeLessThan(rnnBPTT(cueSequence(6, cue), cue, initial).loss * 0.25);
        }
    });
});

describe('feedforward XOR lab', () => {
    test('exact backpropagation matches numerical derivatives of binary cross entropy', () => {
        const weights = createFeedforwardWeights();
        const result = feedforwardGradient(weights);
        const numerical = finiteDifferenceGradient(packFeedforward(weights), values => feedforwardGradient(unpackFeedforward(values)).loss);
        result.gradient.forEach((value, i) => expect(value).toBeCloseTo(numerical[i], 8));
    });
    test('training learns the four actual XOR examples rather than animating fabricated activations', () => {
        const weights = createFeedforwardWeights();
        const trained = trainFeedforward(weights, 1600);
        expect(feedforwardGradient(trained).loss).toBeLessThan(0.04);
        for (const { input, target } of XOR_EXAMPLES) {
            expect(Number(feedforward(input, trained).probability >= 0.5)).toBe(target);
        }
        expect(createFeedforwardWeights()).toEqual(weights);
    });
});
