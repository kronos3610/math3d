import { dot, matvec, projection, type Vector3 } from './ml-attention';

export type StateSpaceVariant = 'ssm' | 'mamba' | 'mamba2' | 'mamba3';
export interface StateSpaceOptions {
    variant: StateSpaceVariant; decay?: number; stepSize?: number; selection?: number;
    angle?: number; lambda?: number; mimo?: boolean;
}
export interface StateSpaceTrace {
    inputs: Vector3[]; states: number[][][]; imaginary: number[][][]; outputs: Vector3[];
    deltas: Vector3[]; transitions: number[][][]; write: number[][][]; read: number[][][];
    retained: number[][][]; written: number[][][]; previousWritten: number[][][];
    options: StateSpaceOptions; stateElements: number;
}
const softplus = (value: number) => Math.log1p(Math.exp(-Math.abs(value))) + Math.max(0, value);

/**
 * Three channels × three states expose the selective SSM core with explicit demo
 * parameters. Mamba-1 has a diagonal A, Mamba-2 scalar A per channel, and Mamba-3
 * uses complex exponential-trapezoidal updates. This is not a pretrained full block.
 */
export function runStateSpace(inputs: readonly Vector3[], options: StateSpaceOptions): StateSpaceTrace {
    const decay = options.decay ?? 0.5; const stepSize = options.stepSize ?? 0.5; const selection = options.selection ?? 1;
    let state = Array.from({ length: 3 }, () => [0,0,0]); let imaginary = Array.from({ length: 3 }, () => [0,0,0]);
    let previousForce = Array.from({ length: 3 }, () => [0,0,0]);
    const trace: StateSpaceTrace = { inputs: inputs.map(input => [...input]), states: [], imaginary: [], outputs: [], deltas: [], transitions: [], write: [], read: [], retained: [], written: [], previousWritten: [], options, stateElements: options.variant === 'mamba3' ? 27 : 9 };
    inputs.forEach(input => {
        const fixed = options.variant === 'ssm';
        const delta = input.map((value, channel) => fixed ? stepSize : stepSize * softplus(selection * value + 0.2 * (channel - 1))) as Vector3;
        const rank = options.variant === 'mamba3' && options.mimo ? 2 : 1;
        const b = fixed ? [[1],[0.5],[-0.25]] : projection(3, rank, 491).map((row, n) => row.map((value, r) => value + selection * 0.35 * input[(n + r) % 3]));
        const c = fixed ? [[0.3],[0.7],[1]] : projection(3, rank, 647).map((row, n) => row.map((value, r) => value + selection * 0.25 * input[(n + r + 1) % 3]));
        const inputStreams: Vector3[] = [input, matvec(projection(3, 3, 751), input) as Vector3];
        const alpha = delta.map((dt, channel) => [0,1,2].map(n => Math.exp(-decay * dt * (options.variant === 'mamba' ? 0.5 + n / 2 + channel / 10 : 1))));
        const retained: number[][] = []; const written: number[][] = []; const previousWritten: number[][] = [];
        const force = [0,1,2].map(channel => [0,1,2].map(n => b[n].reduce((sum, value, r) => sum + value * inputStreams[r][channel], 0)));
        const nextReal: number[][] = []; const nextImag: number[][] = [];
        for (let channel = 0; channel < 3; channel++) {
            retained[channel] = []; written[channel] = []; previousWritten[channel] = []; nextReal[channel] = []; nextImag[channel] = [];
            for (let n = 0; n < 3; n++) {
                const theta = options.variant === 'mamba3' ? (options.angle ?? 0.6) * delta[channel] * (n + 1) : 0;
                const cosine = Math.cos(theta); const sine = Math.sin(theta);
                const oldReal = alpha[channel][n] * (cosine * state[channel][n] - sine * imaginary[channel][n]);
                const oldImag = alpha[channel][n] * (sine * state[channel][n] + cosine * imaginary[channel][n]);
                const lambda = options.variant === 'mamba3' ? options.lambda ?? 0.5 : 1;
                const pastCoefficient = (1 - lambda) * delta[channel] * alpha[channel][n];
                const currentForce = lambda * delta[channel] * force[channel][n];
                const pastReal = pastCoefficient * cosine * previousForce[channel][n];
                const pastImag = pastCoefficient * sine * previousForce[channel][n];
                retained[channel][n] = oldReal; written[channel][n] = currentForce; previousWritten[channel][n] = pastReal;
                nextReal[channel][n] = oldReal + pastReal + currentForce;
                nextImag[channel][n] = oldImag + pastImag;
            }
        }
        state = nextReal; imaginary = nextImag; previousForce = force;
        const output = [0,1,2].map(channel => c[0].reduce((sum, _, r) => sum + state[channel].reduce((value, h, n) => value + c[n][r] * h, 0) / rank, 0)) as Vector3;
        trace.states.push(state.map(row => [...row])); trace.imaginary.push(imaginary.map(row => [...row])); trace.outputs.push(output);
        trace.deltas.push(delta); trace.transitions.push(alpha); trace.write.push(b); trace.read.push(c);
        trace.retained.push(retained); trace.written.push(written); trace.previousWritten.push(previousWritten);
    });
    return trace;
}

/** Exact lower-triangular mixing matrix for the real selective recurrence. */
export function stateSpaceDual(trace: StateSpaceTrace, channel = 0) {
    if (trace.options.variant === 'mamba3') throw new RangeError('The real exponential-Euler dual is only used for the introductory SSM/Mamba-1/-2 core.');
    const matrix = trace.inputs.map((_, time) => trace.inputs.map((__, source) => {
        if (source > time) return 0;
        return [0,1,2].reduce((sum, n) => {
            let decay = 1;
            for (let step = source + 1; step <= time; step++) decay *= trace.transitions[step][channel][n];
            return sum + trace.read[time][n][0] * decay * trace.deltas[source][channel] * trace.write[source][n][0];
        }, 0);
    }));
    return { matrix, outputs: matrix.map(row => dot(row, trace.inputs.map(input => input[channel]))) };
}

export function makeStream(kind: 'cue' | 'impulse' | 'alternating', length: number, noise: number): Vector3[] {
    return Array.from({ length }, (_, time) => kind === 'impulse' ? [time === 0 ? 1 : 0, 0, 0]
        : kind === 'alternating' ? [time % 2 ? -1 : 1, 0.5 * (time % 3 - 1), 0.2]
            : time === 0 ? [1,0,0] : [noise * Math.sin(time * 2.1), noise * Math.cos(time * 1.7), time === length - 1 ? 1 : 0.1]);
}
