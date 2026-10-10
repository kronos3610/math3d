import { useMemo, useState } from 'react';
import { SpatialScene, type SpatialPath, type SpatialPoint } from '../../components/3d/SpatialScene';
import { LabPlayback, LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import {
    createFeedforwardWeights, feedforward, feedforwardGradient, packFeedforward,
    trainFeedforward, unpackFeedforward, XOR_EXAMPLES,
} from '../../utils/ml-sequence';

const CONNECTIONS = [
    { value: '0', label: 'Input 1 → hidden 1' }, { value: '1', label: 'Input 2 → hidden 1' },
    { value: '2', label: 'Input 1 → hidden 2' }, { value: '3', label: 'Input 2 → hidden 2' },
    { value: '4', label: 'Input 1 → hidden 3' }, { value: '5', label: 'Input 2 → hidden 3' },
    { value: '9', label: 'Hidden 1 → output' }, { value: '10', label: 'Hidden 2 → output' },
    { value: '11', label: 'Hidden 3 → output' },
];

export default function NeuralNetworks() {
    const [weights, setWeights] = useState(createFeedforwardWeights);
    const [first, setFirst] = useState(-1);
    const [second, setSecond] = useState(1);
    const [stage, setStage] = useState(2);
    const [view, setView] = useState('network');
    const [connection, setConnection] = useState('0');
    const [trainingSteps, setTrainingSteps] = useState(0);
    const result = useMemo(() => feedforward([first, second], weights), [first, second, weights]);
    const training = useMemo(() => feedforwardGradient(weights), [weights]);
    const predictions = useMemo(() => XOR_EXAMPLES.map(example => feedforward(example.input, weights).probability), [weights]);
    const accuracy = predictions.filter((probability, index) => Number(probability >= 0.5) === XOR_EXAMPLES[index].target).length;
    const values = packFeedforward(weights);
    const network = useMemo(() => {
        const inputPoints: SpatialPoint[] = [first, second].map((value, index) => ({
            position: [-2, index === 0 ? -0.7 : 0.7, value], color: '#fbbf24', radius: 0.13,
            label: `x${index + 1} = ${value.toFixed(2)}`,
        }));
        const hiddenPoints: SpatialPoint[] = result.hidden.map((value, index) => ({
            position: [0, index - 1, value], color: stage >= 1 ? (value >= 0 ? '#2dd4bf' : '#fb7185') : '#475569',
            radius: 0.12 + 0.08 * Math.abs(value), label: stage >= 1 ? `h${index + 1} = ${value.toFixed(2)}` : `h${index + 1}`,
        }));
        const output: SpatialPoint = {
            position: [2, 0, result.probability], color: stage >= 2 ? '#a78bfa' : '#475569', radius: 0.18,
            label: stage >= 2 ? `P(XOR=1) = ${result.probability.toFixed(3)}` : 'Output',
        };
        const paths: SpatialPath[] = [];
        const edgeColor = (value: number, active: boolean) => active ? value >= 0 ? '#2dd4bf' : '#fb7185' : '#334155';
        for (let hidden = 0; hidden < 3; hidden++) for (let input = 0; input < 2; input++) {
            const weight = weights.hidden[hidden][input];
            paths.push({ points: [inputPoints[input].position, hiddenPoints[hidden].position], color: edgeColor(weight, stage >= 1), width: 0.7 + Math.min(4, Math.abs(weight)) });
        }
        for (let hidden = 0; hidden < 3; hidden++) {
            const weight = weights.output[hidden];
            paths.push({ points: [hiddenPoints[hidden].position, output.position], color: edgeColor(weight, stage >= 2), width: 0.7 + Math.min(4, Math.abs(weight)) });
        }
        return { points: [...inputPoints, ...hiddenPoints, output], paths };
    }, [first, second, result, weights, stage]);
    const surface = useMemo(() => {
        const vertices: [number, number, number][] = [];
        for (let row = 0; row <= 20; row++) for (let column = 0; column <= 20; column++) {
            const x = -1 + column / 10; const y = -1 + row / 10;
            vertices.push([x, y, feedforward([x, y], weights).probability]);
        }
        return { vertices, columns: 21, color: '#a78bfa', opacity: 0.65 };
    }, [weights]);
    const controls = <>
        <LabRange label="Input 1" value={first} min={-1} max={1} step={0.05} decimals={2} onChange={setFirst} />
        <LabRange label="Input 2" value={second} min={-1} max={1} step={0.05} decimals={2} onChange={setSecond} />
        <LabSelect label="View" value={view} options={[{ value: 'network', label: 'Computed neuron activations' }, { value: 'surface', label: 'Learned output surface' }]} onChange={setView} />
        <LabSelect label="Inspect connection" value={connection} options={CONNECTIONS} onChange={setConnection} />
        <LabRange label="Connection weight" value={values[Number(connection)]} min={-6} max={6} step={0.05} decimals={2} onChange={value => {
            const parameters = packFeedforward(weights); parameters[Number(connection)] = value;
            setWeights(unpackFeedforward(parameters)); setTrainingSteps(0);
        }} />
        <div className="visual-lab-playback" role="group" aria-label="XOR example inputs">
            {XOR_EXAMPLES.map((example, index) => <button type="button" className="lab-button" key={index}
                aria-pressed={first === example.input[0] && second === example.input[1]}
                onClick={() => { setFirst(example.input[0]); setSecond(example.input[1]); }}>
                {example.input.join(', ')} → {example.target}
            </button>)}
        </div>
        <div className="visual-lab-playback">
            <button type="button" className="lab-button" onClick={() => { setWeights(current => trainFeedforward(current, 200)); setTrainingSteps(current => current + 200); }}>Train 200 steps</button>
            <button type="button" className="lab-button" onClick={() => { setWeights(createFeedforwardWeights()); setTrainingSteps(0); }}>Reset weights</button>
        </div>
        <LabPlayback step={stage} max={2} onStep={setStage} />
    </>;
    const explanation = <SceneExplanation title="A neural network that actually computes" summary="Two numbers pass through three tanh units and a sigmoid output. Every displayed activation comes from the current weights.">
        <ExplanationSection title="Follow one prediction">
            <p>Each hidden unit computes hᵢ = tanh(wᵢ₁x₁ + wᵢ₂x₂ + bᵢ). The output computes p = sigmoid(v·h + b). Height shows an activation; teal connections have positive weights, pink connections negative weights, and thicker connections larger absolute weights.</p>
            <p>Step and Play reveal the layers in order. They do not change the calculation or train the network. Hidden-unit positions within a layer are a layout; their activation height is numerical.</p>
        </ExplanationSection>
        <ExplanationSection title="What training changes">
            <p>The four labeled corner examples teach XOR: the target is 1 when the inputs have different signs and 0 when they have the same sign. Train 200 steps performs 200 real full-batch gradient-descent updates with learning rate 0.3 and binary cross entropy. All 13 weights and biases update through backpropagation.</p>
            <p>The starting weights are hand-selected demonstration values, with no pretrained language or image knowledge. Reset restores them. Editing one connection returns to manual parameters; training starts from those current parameters.</p>
        </ExplanationSection>
        <ExplanationSection title="Read the evidence">
            <table><caption>Current predictions on the training examples</caption><thead><tr><th>Inputs</th><th>Target</th><th>Output</th></tr></thead><tbody>
                {XOR_EXAMPLES.map((example, index) => <tr key={index}><td>{example.input.join(', ')}</td><td>{example.target}</td><td>{predictions[index].toFixed(3)}</td></tr>)}
            </tbody></table>
            <p>Correct examples uses a 0.5 cutoff on these four training points. The surface between them is the network's actual output, but no interior points were labeled. A sigmoid value is a model score; four toy examples do not establish calibration or real-world accuracy.</p>
        </ExplanationSection>
    </SceneExplanation>;
    return <VisualLab title="Feedforward neural network" subtitle="Compute a prediction, then train a small network on XOR."
        controls={controls} metrics={[
            { label: 'Output probability', value: result.probability.toFixed(3) },
            { label: 'Training loss', value: training.loss.toFixed(4) },
            { label: 'Correct examples', value: `${accuracy} / 4` },
            { label: 'Training updates', value: trainingSteps },
        ]} insight={`${trainingSteps > 0 ? `After ${trainingSteps} actual updates` : 'Manual demonstration weights'}: hidden state (${result.hidden.map(value => value.toFixed(2)).join(', ')}), output ${result.probability.toFixed(3)}. ${stage === 0 ? 'Showing inputs.' : stage === 1 ? 'Showing the tanh hidden layer.' : 'Showing the sigmoid output.'}`}
        challenge="Train several times, inspect all four corners, then edit one connection and watch the measured loss change."
        explanation={explanation}>
        {view === 'network' ? <SpatialScene {...network} equalScale={false} axes={['layer', 'unit layout', 'activation']}
            description="Computed 2-input, 3-hidden-unit, 1-output feedforward network. Node height is its actual activation; connection color and width encode weight sign and magnitude." />
            : <SpatialScene surfaces={[surface]} points={[
                ...XOR_EXAMPLES.map(example => ({ position: [...example.input, example.target] as [number, number, number], color: example.target ? '#2dd4bf' : '#fb7185', label: `target ${example.target}` })),
                { position: [first, second, result.probability], color: '#fbbf24', radius: 0.15, label: 'Current prediction' },
            ]} axes={['input 1', 'input 2', 'output probability']}
                description="Actual sigmoid output over the two input coordinates. Four corner points show XOR training targets; the yellow point shows the selected prediction." />}
    </VisualLab>;
}
