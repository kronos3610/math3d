import { VIZ } from '../../data/palette';
import { useMemo, useState } from 'react';
import { SpatialScene, type SpatialPath, type SpatialPoint, type SpatialVector } from '../../components/3d/SpatialScene';
import { LabPlayback, LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import {
    baumWelchStep, clipGradient, createDemoHMM, createGRUWeights, createLSTMWeights,
    createRNNWeights, cueSequence, filterHMM, finiteDifferenceGradient, gateContributions, packRNN,
    rnnBPTT, rnnPrediction, runGRU, runLSTM, runRNN, trainCueRNN, unpackRNN, viterbiHMM,
    type HiddenMarkovModel, type RecurrentWeights, type State3,
} from '../../utils/ml-sequence';

export type SequenceMode = 'hmm' | 'rnn' | 'lstm' | 'gru' | 'gradients';
export interface SequenceLabProps { mode?: SequenceMode; }
const STATE_COLORS = [VIZ.data, VIZ.truth, VIZ.error];
const STATE_NAMES = ['Calm', 'Active', 'Alert'];
const SENSOR_NAMES = ['low', 'medium', 'high'];
const SENSOR_SEQUENCES: Record<string, number[]> = {
    rising: [0, 0, 1, 1, 2, 2, 1, 0],
    noisy: [0, 2, 0, 1, 2, 1, 0, 2],
    steady: [1, 1, 1, 1, 1, 1, 1, 1],
};
const coordinateText = (values: readonly number[]) => `(${values.map(value => value.toFixed(3)).join(', ')})`;
const vectorNorm = (values: readonly number[]) => Math.hypot(...values);

function HiddenMarkovLab() {
    const [persistence, setPersistence] = useState(0.8);
    const [sequence, setSequence] = useState('rising');
    const [step, setStep] = useState(1);
    const [view, setView] = useState('trellis');
    const [learned, setLearned] = useState<HiddenMarkovModel | null>(null);
    const [updates, setUpdates] = useState(0);
    const observations = SENSOR_SEQUENCES[sequence];
    const model = useMemo(() => learned ?? createDemoHMM(persistence), [learned, persistence]);
    const prefix = useMemo(() => observations.slice(0, step), [observations, step]);
    const result = useMemo(() => filterHMM(model, prefix), [model, prefix]);
    const viterbi = useMemo(() => viterbiHMM(model, prefix), [model, prefix]);
    const sequenceLikelihood = useMemo(() => filterHMM(model, observations).logLikelihood, [model, observations]);
    const belief = result.filtered.at(-1) ?? model.initial;
    const best = belief.indexOf(Math.max(...belief));
    const trellis = useMemo(() => {
        const rows = step === 0 ? [model.initial] : result.filtered;
        const points: SpatialPoint[] = [];
        const paths: SpatialPath[] = [];
        rows.forEach((row, time) => row.forEach((probability, state) => {
            points.push({ position: [time + (step === 0 ? 0 : 1), state, probability], color: STATE_COLORS[state], radius: 0.05 + probability * 0.14,
                label: time === rows.length - 1 ? `${STATE_NAMES[state]} ${(100 * probability).toFixed(1)}%` : undefined });
            if (time > 0) for (let previous = 0; previous < 3; previous++) {
                paths.push({ points: [[time, previous, rows[time - 1][previous]], [time + 1, state, probability]], color: VIZ.muted, width: 0.5 + model.transition[previous][state] });
            }
        }));
        if (viterbi.path.length > 1) paths.push({ points: viterbi.path.map((state, time) => [time + 1, state, rows[time][state]] as State3), color: VIZ.focus, width: 3 });
        return { points, paths };
    }, [model, result, viterbi, step]);
    const simplex = useMemo(() => {
        const corners: State3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const trajectory = [model.initial, ...result.filtered];
        return {
            points: [
                ...corners.map((position, state) => ({ position, color: STATE_COLORS[state], label: `100% ${STATE_NAMES[state]}` })),
                ...trajectory.map((position, index) => ({ position, color: index === trajectory.length - 1 ? VIZ.focus : VIZ.output, radius: 0.06,
                    label: index === trajectory.length - 1 ? `Belief after ${step} readings` : undefined })),
            ],
            paths: [{ points: [...corners, corners[0]], color: '#64748b' }, { points: trajectory, color: VIZ.output, width: 2 }],
        };
    }, [model, result, step]);
    const controls = <>
        <LabSelect label="Sensor readings" value={sequence} options={[{ value: 'rising', label: 'Rise and return' }, { value: 'noisy', label: 'Conflicting readings' }, { value: 'steady', label: 'Steady medium' }]} onChange={value => { setSequence(value); setStep(1); setLearned(null); setUpdates(0); }} />
        <LabRange label="State persistence (manual model)" value={persistence} min={0.1} max={0.95} step={0.05} decimals={2} onChange={value => { setPersistence(value); setLearned(null); setUpdates(0); }} />
        <LabSelect label="View" value={view} options={[{ value: 'trellis', label: 'State trellis + Viterbi path' }, { value: 'simplex', label: 'Probability simplex' }]} onChange={setView} />
        <LabPlayback step={step} max={observations.length} onStep={setStep} />
        <div className="visual-lab-playback" role="group" aria-label="Observed sensor sequence">
            {observations.map((observation, time) => <button type="button" className="lab-button" key={time} aria-pressed={step === time + 1}
                aria-label={`Read through observation ${time + 1}: ${SENSOR_NAMES[observation]}`} onClick={() => setStep(time + 1)}>{time + 1}: {SENSOR_NAMES[observation]}</button>)}
        </div>
        <div className="visual-lab-playback">
            <button type="button" className="lab-button" onClick={() => { setLearned(baumWelchStep(model, observations)); setUpdates(current => current + 1); setStep(observations.length); }}>Fit one EM update (all readings)</button>
            <button type="button" className="lab-button" onClick={() => { setLearned(null); setUpdates(0); }}>Reset model</button>
        </div>
    </>;
    const explanation = <SceneExplanation title="Hidden Markov models" summary="Infer an unseen state from a sequence of noisy sensor readings using a specified probability model.">
        <ExplanationSection title="A concrete filtering step">
            <p>Our fictional device has three hidden states: Calm, Active, and Alert. Its sensor reports low, medium, or high. The initial chances are 50%, 30%, and 20%. For example, a Calm state reports low 75% of the time, medium 20%, and high 5%.</p>
            <p>For the first reading, multiply each initial chance by that state's chance of emitting the reading, then divide by the total. After that, predict the next-state chances through the transition matrix before applying the new reading. Every yellow belief is normalized to sum to one.</p>
        </ExplanationSection>
        <ExplanationSection title="Two different answers">
            <p>Filtering gives P(state at t | readings 1…t). The colored trellis nodes display those chances: time, state row, and posterior probability are the three coordinates. Gray edges show permitted transitions; their thickness encodes transition probability, not posterior path probability.</p>
            <p>The yellow Viterbi path is the single most probable entire state sequence for the readings revealed so far. It can disagree with choosing the biggest filtering chance independently at each time. Previously selected Viterbi states can change after another reading. Neither procedure reveals a known true hidden state here.</p>
            <p>In the simplex view, the coordinates are the three probabilities themselves. They lie on the triangle p₁+p₂+p₃=1. Moving toward a corner means more confidence in that state; the triangle is not a physical device trajectory.</p>
        </ExplanationSection>
        <ExplanationSection title="Optional model fitting">
            <p>Fit one EM update uses forward–backward responsibilities on all eight visible readings to update the initial, transition, and emission probabilities. The displayed whole-sequence log likelihood should increase or stay equal. Filtering still uses only the prefix selected by playback, but the fitted model has used the whole sequence.</p>
            <p>These are invented rates and state labels. One very short sequence can be overfit, EM can reach a local optimum, and hidden-state labels are not identifiable without outside evidence. Reset returns to the specified manual model; the persistence slider sets its diagonal transition chances.</p>
            <table><caption>Current emission probabilities: P(reading | state)</caption><thead><tr><th>State</th>{SENSOR_NAMES.map(name => <th key={name}>{name}</th>)}</tr></thead><tbody>
                {model.emission.map((row, state) => <tr key={state}><td>{STATE_NAMES[state]}</td>{row.map((value, category) => <td key={category}>{value.toFixed(3)}</td>)}</tr>)}
            </tbody></table>
        </ExplanationSection>
    </SceneExplanation>;
    return <VisualLab title="Hidden Markov model" subtitle="Read noisy evidence, update the state belief, and compare it with the best path."
        controls={controls} metrics={[
            { label: 'Most likely current state', value: `${STATE_NAMES[best]} ${(belief[best] * 100).toFixed(1)}%` },
            { label: 'Belief sum', value: belief.reduce((sum, value) => sum + value, 0).toFixed(3) },
            { label: 'Sequence log likelihood', value: sequenceLikelihood.toFixed(3) },
            { label: 'EM updates', value: updates },
        ]} insight={`${updates ? `EM-fitted model (${updates} updates)` : 'Manual fictional sensor model'}. ${step === 0 ? 'Before any readings' : `After ${step} readings`}: Calm ${(100 * belief[0]).toFixed(1)}%, Active ${(100 * belief[1]).toFixed(1)}%, Alert ${(100 * belief[2]).toFixed(1)}%. ${viterbi.path.length ? `Best path: ${viterbi.path.map(state => STATE_NAMES[state]).join(' → ')}.` : ''}`}
        challenge="Select Conflicting readings, step forward, then switch to the simplex to see belief move rather than a state being certain."
        explanation={explanation}>
        {view === 'trellis' ? <SpatialScene {...trellis} equalScale={false} axes={['reading number', 'state row', 'filtering probability']}
            description="HMM state trellis for readings revealed so far. Colored nodes show normalized filtering probabilities; yellow edges trace the computed Viterbi path." />
            : <SpatialScene {...simplex} axes={['P(Calm)', 'P(Active)', 'P(Alert)']}
                description="Probability simplex with the three pure-state corners and the actual normalized posterior trajectory after each revealed sensor reading." />}
    </VisualLab>;
}

function RecurrentLab({ mode }: { mode: 'rnn' | 'lstm' | 'gru' }) {
    const [length, setLength] = useState(12);
    const [cue, setCue] = useState(1);
    const [inputKind, setInputKind] = useState('quiet');
    const [scale, setScale] = useState(0.9);
    const [gateBias, setGateBias] = useState(1.5);
    const [inputBias, setInputBias] = useState(0.25);
    const [outputBias, setOutputBias] = useState(1);
    const [resetBias, setResetBias] = useState(0);
    const [step, setStep] = useState(1);
    const [coordinate, setCoordinate] = useState('0');
    const [view, setView] = useState('hidden');
    const [trained, setTrained] = useState<RecurrentWeights | null>(null);
    const [updates, setUpdates] = useState(0);
    const inputs = useMemo(() => cueSequence(length, cue, inputKind === 'distractors'), [length, cue, inputKind]);
    const rnnWeights = useMemo(() => trained ?? createRNNWeights(scale), [trained, scale]);
    const steps = useMemo(() => mode === 'rnn' ? runRNN(inputs, rnnWeights) : mode === 'lstm' ? runLSTM(inputs, createLSTMWeights(gateBias, inputBias, outputBias)) : runGRU(inputs, createGRUWeights(gateBias, resetBias)), [mode, inputs, rnnWeights, gateBias, inputBias, outputBias, resetBias]);
    const visibleSteps = useMemo(() => steps.slice(0, step), [steps, step]);
    const contributions = useMemo(() => mode === 'rnn' ? null : gateContributions(mode, steps, step - 1), [mode, steps, step]);
    const current = visibleSteps.at(-1);
    const hidden = current?.hidden ?? [0, 0, 0];
    const finalNorm = vectorNorm(steps.at(-1)!.hidden);
    const cueNorm = vectorNorm(steps[0].hidden);
    const retained = cueNorm > 0 ? finalNorm / cueNorm : 0;
    const readout = rnnPrediction(visibleSteps, rnnWeights);
    const scene = useMemo(() => {
        if (view === 'contributions' && contributions) {
            const origin: State3 = [0, 0, 0];
            const vectors: SpatialVector[] = [
                { from: origin, to: contributions.retained, color: VIZ.data, label: 'Retained' },
                { from: origin, to: contributions.written, color: VIZ.error, label: mode === 'lstm' ? 'New write' : 'Weighted candidate' },
                { from: contributions.retained, to: contributions.combined, color: VIZ.error },
                { from: origin, to: contributions.combined, color: VIZ.output, label: mode === 'lstm' ? 'Cell sum' : 'Hidden sum' },
                ...(mode === 'lstm' ? [{ from: origin, to: contributions.exposed, color: VIZ.focus, label: 'Exposed hidden' }] : []),
            ];
            return { points: [{ position: origin, color: '#64748b', label: 'Zero' }], vectors,
                paths: [{ points: [contributions.written, contributions.combined], color: VIZ.data, dashed: true }] };
        }
        const values = view === 'cell' ? visibleSteps.map(row => row.cell!) : visibleSteps.map(row => row.hidden);
        if (view === 'unrolled') {
            return {
                points: values.flatMap((state, time) => state.map((value, dimension) => ({ position: [time + 1, value, dimension] as State3, color: STATE_COLORS[dimension], radius: 0.07,
                    label: time === values.length - 1 ? `h${dimension + 1}=${value.toFixed(3)}` : undefined }))),
                paths: [0, 1, 2].map(dimension => ({ points: [[0, 0, dimension] as State3, ...values.map((state, time) => [time + 1, state[dimension], dimension] as State3)], color: STATE_COLORS[dimension] })),
            };
        }
        return {
            points: [{ position: [0, 0, 0] as State3, color: '#64748b', label: 'Start' }, ...values.map((position, time) => ({ position, color: time === values.length - 1 ? VIZ.focus : VIZ.truth, radius: time === values.length - 1 ? 0.1 : 0.06,
                label: time === 0 ? 'Cue' : time === values.length - 1 ? `t=${time + 1}` : undefined }))],
            paths: [{ points: [[0, 0, 0] as State3, ...values], color: VIZ.truth, width: 2 }],
        };
    }, [view, visibleSteps, contributions, mode]);
    const title = mode === 'rnn' ? 'Recurrent neural network' : mode === 'lstm' ? 'Long short-term memory' : 'Gated recurrent unit';
    const coordinateIndex = Number(coordinate);
    const gateText = current?.gates ? Object.entries(current.gates).map(([name, gate]) => `${name}=${gate[coordinateIndex].toFixed(3)}`).join(', ') : '';
    const changeLength = (value: number) => { setLength(value); setStep(Math.min(step, value)); setTrained(null); setUpdates(0); };
    const controls = <>
        <LabRange label="Sequence length" value={length} min={3} max={24} onChange={changeLength} />
        <LabRange label="First cue" value={cue} min={-1} max={1} step={0.1} decimals={1} onChange={setCue} />
        <LabSelect label="After the cue" value={inputKind} options={[{ value: 'quiet', label: 'Zero inputs: memory alone' }, { value: 'distractors', label: 'Small sinusoidal distractors' }]} onChange={setInputKind} />
        {mode === 'rnn' ? <LabRange label="Recurrent scale (manual weights)" value={scale} min={0} max={1.8} step={0.05} decimals={2} onChange={value => { setScale(value); setTrained(null); setUpdates(0); }} />
            : <LabRange label={mode === 'lstm' ? 'Forget-gate bias (manual weights)' : 'Retain-gate bias (manual weights)'} value={gateBias} min={-3} max={5} step={0.25} decimals={2} onChange={setGateBias} />}
        {mode === 'lstm' && <>
            <LabRange label="Input-gate bias (manual weights)" value={inputBias} min={-5} max={5} step={0.25} decimals={2} onChange={setInputBias} />
            <LabRange label="Output-gate bias (manual weights)" value={outputBias} min={-5} max={5} step={0.25} decimals={2} onChange={setOutputBias} />
        </>}
        {mode === 'gru' && <LabRange label="Reset-gate bias (manual weights)" value={resetBias} min={-5} max={5} step={0.25} decimals={2} onChange={setResetBias} />}
        <LabSelect label="View" value={view} options={[
            { value: 'hidden', label: 'Actual 3D hidden-state path' }, { value: 'unrolled', label: 'Unroll the three coordinates over time' },
            ...(mode === 'lstm' ? [{ value: 'cell', label: 'Actual 3D cell-memory path' }] : []),
            ...(mode !== 'rnn' ? [{ value: 'contributions', label: 'Gate contributions at this step' }] : []),
        ]} onChange={setView} />
        {mode !== 'rnn' && <LabSelect label="Inspect gate coordinate" value={coordinate} options={[{ value: '0', label: 'Coordinate 1' }, { value: '1', label: 'Coordinate 2' }, { value: '2', label: 'Coordinate 3' }]} onChange={setCoordinate} />}
        <LabPlayback step={step} max={length} onStep={setStep} />
        {mode !== 'rnn' && <button type="button" className="lab-button" onClick={() => { setGateBias(1.5); setInputBias(0.25); setOutputBias(1); setResetBias(0); }}>Reset gate biases</button>}
        {mode === 'rnn' && <div className="visual-lab-playback">
            <button type="button" className="lab-button" onClick={() => { setTrained(trainCueRNN(rnnWeights, length, 100)); setUpdates(current => current + 100); setInputKind('quiet'); setStep(length); }}>Train cue task 100 steps</button>
            <button type="button" className="lab-button" onClick={() => { setTrained(null); setUpdates(0); }}>Reset weights</button>
        </div>}
    </>;
    const explanation = <SceneExplanation title={title} summary="The same weights are reused at every time step. The trajectory is the computed state of a three-coordinate toy model.">
        <ExplanationSection title="Read a sequence">
            <p>The first input is a signed cue. Later inputs are zero or small distractors. Step processes one input; Reset returns playback to the zero state. A larger final state does not by itself mean the cue was remembered correctly: compare both cue signs, and check whether distractors drive the state.</p>
            <p>Hidden-state view uses the three actual numerical coordinates, without a projection from a larger model. Unrolled view uses time, coordinate value, and a coordinate-number layout. The same fixed weights are applied at every time, so increasing sequence length adds computation rather than parameters.</p>
        </ExplanationSection>
        <ExplanationSection title="What this cell computes">
            {mode === 'rnn' ? <><p>hₜ = tanh(Wₓxₜ + Wₕhₜ₋₁ + b). The output is the linear readout v·hₜ+bᵧ, not a probability. Recurrence can preserve, mix, shrink, or saturate the signed cue.</p>
                <p>Train cue task performs 100 actual full-batch gradient-descent updates on two sequences: +1 followed by zeros, and −1 followed by zeros. Targets are the original cue at the last step. Learning rate is 0.08 and global gradient norm is clipped at 1. The readout and recurrence both update. These two training examples are not evidence of general sequence understanding.</p></>
                : mode === 'lstm' ? <><p>i, f, and o are sigmoid gates. g is a tanh candidate. The memory is cₜ=fₜ⊙cₜ₋₁+iₜ⊙gₜ; the visible hidden state is hₜ=oₜ⊙tanh(cₜ). Inspect the separate cell path: stored memory and visible output can differ.</p>
                    <p>Separate input, forget, and output biases shift their actual sigmoid gates; a bias is not the gate value itself. Gates depend on the current input and previous hidden state. A large forget gate preserves part of the old memory, but additional writes, saturation, and the output gate still matter. This modern forget-gate LSTM has no peephole connections or trained weights.</p>
                    <p><a href="https://doi.org/10.1162/neco.1997.9.8.1735" target="_blank" rel="noreferrer">Original LSTM paper</a>.</p></>
                    : <><p>The sigmoid update gate z retains old state in this convention: hₜ=zₜ⊙hₜ₋₁+(1−zₜ)⊙gₜ. The reset gate r multiplies the previous hidden state before the candidate's recurrent matrix: gₜ=tanh(Wₓxₜ+Wₕ(rₜ⊙hₜ₋₁)+b).</p>
                        <p>Some libraries name the complementary gate or apply reset after the matrix multiplication; those are different conventions. Here the displayed gates match the equation above exactly. GRU has no separate cell-memory vector.</p>
                        <p>Retain-gate bias shifts z; reset-gate bias shifts r. Changing reset changes how much of the old state reaches the candidate computation, rather than directly multiplying the final retained term.</p>
                        <p><a href="https://arxiv.org/abs/1406.1078" target="_blank" rel="noreferrer">Original gated encoder–decoder paper</a>.</p></>}
        </ExplanationSection>
        {mode !== 'rnn' && <ExplanationSection title="Inspect actual gate contributions">
            <p>Gate contributions shows vectors in the same three numerical state coordinates, with no categorical axis. Blue is retained memory {mode === 'lstm' ? 'f⊙cprevious' : 'z⊙hprevious'}; pink is the {mode === 'lstm' ? 'new write i⊙g' : 'weighted candidate (1−z)⊙g'}. Their vector sum is violet. {mode === 'lstm' ? 'Yellow is the separately exposed output o⊙tanh(c); closing output can hide a stored cell without deleting it.' : 'The sum is the new hidden state, with no separate cell vector.'}</p>
            <p>The copied contribution arrows form a vector-addition parallelogram. Their lengths are numerical contribution magnitudes, not gate probabilities or importance scores. At the selected time: retained={coordinateText(contributions!.retained)}, written={coordinateText(contributions!.written)}, sum={coordinateText(contributions!.combined)}, hidden={coordinateText(contributions!.exposed)}.</p>
        </ExplanationSection>}
        <ExplanationSection title="What this demonstrates">
            <p>{mode === 'rnn' && updates > 0 ? `The RNN has received ${updates} full-batch gradient-descent updates on the two cue examples.` : 'All current weights are manual demonstration parameters.'} The paths show a real recurrence, not learned words, meanings, or pretrained behavior. Sequence models can be trained for signals, forecasting, and text, but architecture alone establishes none of those capabilities.</p>
            <p>Final/first state norm compares the size of two hidden states. It is a descriptive measurement, not an accuracy score, and it can exceed one if inputs or recurrence amplify the state. When the first state is zero the ratio is displayed as undefined.</p>
        </ExplanationSection>
    </SceneExplanation>;
    const metrics = [
        { label: 'Processed inputs', value: `${step} / ${length}` },
        { label: 'Current hidden norm', value: vectorNorm(hidden).toFixed(4) },
        { label: 'Final / first state norm', value: cueNorm > 0 ? retained.toFixed(3) : 'undefined' },
        ...(mode === 'rnn' ? [{ label: 'Current linear readout', value: readout.toFixed(3) }] : [{ label: 'Gate coordinate', value: coordinateIndex + 1 }]),
        ...(view === 'contributions' && contributions ? [{ label: 'Retained vector', value: coordinateText(contributions.retained) }, { label: 'Written vector', value: coordinateText(contributions.written) }] : []),
    ];
    return <VisualLab title={title} subtitle="A signed cue enters once. Follow what the computed state keeps as time passes." controls={controls} metrics={metrics}
        insight={`${updates ? `Trained on two cue sequences (${updates} full-batch gradient-descent updates)` : 'Manual demonstration weights'}. At t=${step}, h=${coordinateText(hidden)}.${current?.cell ? ` Cell memory c=${coordinateText(current.cell)}.` : ''}${gateText ? ` Coordinate ${coordinateIndex + 1}: ${gateText}.` : ''}`}
        challenge={mode === 'rnn' ? 'Compare recurrent scales 0.4 and 1.2, then train the quiet cue task and test the opposite cue.' : 'Compare gate biases −2 and 3, and inspect the path after many zero inputs.'}
        explanation={explanation}>
        <SpatialScene {...scene} equalScale={view !== 'unrolled'} axes={view === 'unrolled' ? ['time step', 'hidden value', 'coordinate number'] : view === 'contributions' ? ['state coordinate 1', 'state coordinate 2', 'state coordinate 3'] : view === 'cell' ? ['cell c₁', 'cell c₂', 'cell c₃'] : ['hidden h₁', 'hidden h₂', 'hidden h₃']}
            description={view === 'contributions' ? `${title}: actual retained and written state vectors, their sum, ${mode === 'lstm' ? 'and the exposed hidden vector' : 'which is the new hidden state'}. Blue is retained, pink is written, violet is their sum.` : view === 'unrolled' ? `${title}: three actual hidden-coordinate traces over the revealed time steps.` : `${title}: actual three-dimensional ${view === 'cell' ? 'cell-memory' : 'hidden-state'} trajectory from zero through the revealed inputs.`} />
    </VisualLab>;
}

function GradientLab() {
    const [length, setLength] = useState(16);
    const [scale, setScale] = useState(0.9);
    const [cue, setCue] = useState(0.2);
    const [window, setWindow] = useState(16);
    const [limit, setLimit] = useState(1);
    const [view, setView] = useState('gradients');
    const inputs = useMemo(() => cueSequence(length, cue), [length, cue]);
    const weights = useMemo(() => createRNNWeights(scale), [scale]);
    const full = useMemo(() => rnnBPTT(inputs, 1, weights), [inputs, weights]);
    const truncated = useMemo(() => rnnBPTT(inputs, 1, weights, window), [inputs, weights, window]);
    const clipped = useMemo(() => clipGradient(truncated.gradient, limit), [truncated, limit]);
    const numerical = useMemo(() => finiteDifferenceGradient(packRNN(weights), parameters => rnnBPTT(inputs, 1, unpackRNN(parameters)).loss,
        index => 1e-5 / Math.max(1, Math.abs(full.gradient[index]))), [inputs, weights, full]);
    const discrepancy = Math.max(...full.gradient.map((value, index) => Math.abs(value - numerical[index]) / Math.max(1, Math.abs(value), Math.abs(numerical[index]))));
    const scene = useMemo(() => {
        if (view === 'parameters') {
            return {
                points: truncated.gradient.flatMap((value, index) => [
                    { position: [index, value, 0] as State3, color: VIZ.error, radius: 0.06 },
                    { position: [index, clipped.gradient[index], 1] as State3, color: VIZ.truth, radius: 0.06 },
                ]),
                paths: [{ points: truncated.gradient.map((value, index) => [index, value, 0] as State3), color: VIZ.error },
                    { points: clipped.gradient.map((value, index) => [index, value, 1] as State3), color: VIZ.truth }],
            };
        }
        const height = (value: number) => Math.log10(Math.max(1e-12, value));
        return {
            points: full.stateGradientNorms.flatMap((value, time) => [
                { position: [time + 1, height(value), 0] as State3, color: VIZ.output, radius: 0.06 },
                ...(truncated.stateGradientNorms[time] > 0 ? [{ position: [time + 1, height(truncated.stateGradientNorms[time]), 1] as State3, color: VIZ.truth, radius: 0.06 }] : []),
            ]),
            paths: [{ points: full.stateGradientNorms.map((value, time) => [time + 1, height(value), 0] as State3), color: VIZ.output, width: 2 },
                { points: truncated.stateGradientNorms.flatMap((value, time) => value > 0 ? [[time + 1, height(value), 1] as State3] : []), color: VIZ.truth, width: 2 }],
        };
    }, [view, full, truncated, clipped]);
    const controls = <>
        <LabRange label="Sequence length" value={length} min={3} max={32} onChange={value => { setLength(value); setWindow(Math.min(window, value)); }} />
        <LabRange label="Recurrent scale" value={scale} min={0.1} max={2} step={0.05} decimals={2} onChange={setScale} />
        <LabRange label="First cue magnitude" value={cue} min={0} max={1} step={0.05} decimals={2} onChange={setCue} />
        <LabRange label="Backpropagation window" value={window} min={1} max={length} onChange={setWindow} />
        <LabRange label="Global clipping threshold" value={limit} min={0.05} max={5} step={0.05} decimals={2} onChange={setLimit} />
        <LabSelect label="View" value={view} options={[{ value: 'gradients', label: 'Gradient flow through time' }, { value: 'parameters', label: 'Shared parameter gradients before/after clipping' }]} onChange={setView} />
    </>;
    const explanation = <SceneExplanation title="Memory and backpropagation through time" summary="Measure actual derivatives of a final-step error through a shared-weight tanh recurrence.">
        <ExplanationSection title="A measured learning signal">
            <p>A cue enters at time 1; every later input is zero. The final linear readout is compared with the fixed target +1 using L=½(prediction−1)². Backpropagation differentiates this actual computation graph. The purple path plots log₁₀‖∂L/∂hₜ‖. One unit down means a tenfold smaller state gradient.</p>
            <p>Each backward step multiplies by Wₕᵀ and by the tanh derivative 1−h². Small recurrence can shrink the gradient; large recurrence can amplify it, but saturated tanh units can shrink it again. A larger recurrent scale does not guarantee an exploding gradient.</p>
        </ExplanationSection>
        <ExplanationSection title="Truncation and clipping do different jobs">
            <p>The green path keeps only the selected final window of backward steps. Earlier states are detached; omitted green points have zero gradient. Forward hidden states and the loss are unchanged. Truncated parameter gradients are biased approximations to the full derivative.</p>
            <p>Clipping acts on the complete 19-parameter gradient vector after accumulation. If its norm exceeds the threshold, every component is multiplied by threshold/norm. It limits the size of a subsequent update but does not restore a vanished early gradient, alter the forward pass, or change the displayed state-gradient paths. Parameter view compares the unclipped pink vector and clipped green vector; its third coordinate is just a before/after layout.</p>
        </ExplanationSection>
        <ExplanationSection title="Check the calculation">
            <p>The full analytic gradient is checked against central finite differences of all 19 parameters. The perturbation is 10⁻⁵/max(1, |analytic derivative|), reducing the perturbation when a steep recurrence amplifies it. The displayed check error is the largest discrepancy divided by max(1, |analytic derivative|, |numerical derivative|). This is an absolute check for small derivatives and a relative check for large ones.</p>
            <p>The comparison always uses full BPTT: a truncated backward pass is not the derivative of the unchanged forward loss. Finite differences remain an approximation with floating-point limits, especially around very steep or saturated dynamics.</p>
            <p>Zero or extremely small state gradients are floored at 10⁻¹² only for the log plot. Clipping and truncation are controls on computed gradients here; they do not run optimizer steps. For actual training, open the RNN cue task or the feedforward XOR lab.</p>
        </ExplanationSection>
    </SceneExplanation>;
    return <VisualLab title="Memory gradients" subtitle="See how a final error reaches earlier states, then separate truncation from clipping."
        controls={controls} metrics={[
            { label: 'Final-step loss', value: full.loss.toFixed(5) },
            { label: 'First-state gradient norm', value: full.stateGradientNorms[0].toExponential(2) },
            { label: 'Parameter norm before → after', value: `${clipped.norm.toFixed(3)} → ${vectorNorm(clipped.gradient).toFixed(3)}` },
            { label: 'Gradient check error', value: discrepancy.toExponential(2) },
        ]} insight={`Manual demonstration RNN. Full BPTT reaches ${length} steps; the selected window reaches ${window}. Global clipping multiplies its parameter gradient by ${clipped.scale.toFixed(3)}. Prediction ${full.prediction.toFixed(3)} and loss stay unchanged by both controls.`}
        challenge="Reduce the backward window, then lower the clipping threshold. Notice which plotted quantity each control changes."
        explanation={explanation}>
        <SpatialScene {...scene} equalScale={false}
            axes={view === 'parameters' ? ['parameter index', 'gradient component', 'before / after clipping'] : ['time step', 'log₁₀ state-gradient norm', 'full / truncated layout']}
            description={view === 'parameters' ? 'Computed shared RNN parameter gradients before and after global norm clipping. Pink is unclipped; green is clipped.' : 'Measured full and truncated BPTT state-gradient norms on a log10 scale. Purple is full; green is the retained backward window. Axes are independently scaled.'} />
    </VisualLab>;
}

export default function SequenceLab({ mode = 'rnn' }: SequenceLabProps) {
    if (mode === 'hmm') return <HiddenMarkovLab />;
    if (mode === 'gradients') return <GradientLab />;
    return <RecurrentLab key={mode} mode={mode} />;
}
