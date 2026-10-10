import { useMemo, useState } from 'react';
import { LabPlayback, LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { SpatialScene, type SpatialPoint, type SpatialPath, type SpatialVector, type SpatialBox } from '../../components/3d/SpatialScene';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import { magnitude } from '../../utils/ml-attention';
import { makeStream, runStateSpace, stateSpaceDual, type StateSpaceVariant } from '../../utils/ml-state-space';

const TITLES: Record<StateSpaceVariant,string> = { ssm: 'State-space models: inputs, dynamics & readout', mamba: 'Mamba: selective state-space memory', mamba2: 'Mamba-2: recurrence & structured mixing', mamba3: 'Mamba-3: complex states & MIMO' };
export default function StateSpaceLab({ mode = 'ssm' }: { mode?: StateSpaceVariant }) {
    const [decay, setDecay] = useState(0.5); const [stepSize, setStepSize] = useState(0.5); const [selection, setSelection] = useState(1);
    const [angle, setAngle] = useState(0.8); const [lambda, setLambda] = useState(0.5); const [mimo, setMimo] = useState(false);
    const [noise, setNoise] = useState(0.2); const [length, setLength] = useState(12); const [kind, setKind] = useState<'cue'|'impulse'|'alternating'>('cue');
    const [step, setStep] = useState(4); const [channel, setChannel] = useState(0); const [view, setView] = useState('state');
    const inputs = useMemo(() => makeStream(kind, length, noise), [kind,length,noise]);
    const trace = useMemo(() => runStateSpace(inputs, { variant: mode, decay,stepSize,selection,angle,lambda,mimo }), [inputs,mode,decay,stepSize,selection,angle,lambda,mimo]);
    const dual = useMemo(() => mode === 'mamba3' ? null : stateSpaceDual(trace,channel), [mode,trace,channel]);
    const current = Math.min(step,length - 1); const state = trace.states[current][channel];
    const error = dual ? Math.max(...dual.outputs.map((value,time) => Math.abs(value - trace.outputs[time][channel]))) : 0;
    const plot = useMemo(() => {
        const points: SpatialPoint[] = []; const paths: SpatialPath[] = []; const vectors: SpatialVector[] = []; const boxes: SpatialBox[] = [];
        let axes: [string,string,string]; let description: string;
        if (view === 'matrix' && dual) {
            axes = ['input timestep','mixing coefficient','output timestep']; description = 'The lower-triangular mixing matrix weights each past input. Heights are signed coefficients, not probabilities. Matrix and recurrence outputs agree.';
            dual.matrix.slice(0,current + 1).forEach((row,time) => row.forEach((weight,source) => {
                if (source > time) return;
                boxes.push({ position:[source,weight / 2,time], size:[0.75,Math.max(0.003,Math.abs(weight)),0.75], color:weight >= 0 ? '#2dd4bf' : '#fb7185',opacity:0.8 });
            }));
        } else if (view === 'flow') {
            axes = ['timestep',mode === 'mamba3' ? 'real state / input value' : 'state / input value','state coordinate']; description = `An unrolled selective recurrence shows each ${mode === 'mamba3' ? 'real state component' : 'state coordinate'} through time. Input points and retained-state links use the same calculated update.`;
            inputs.slice(0,current + 1).forEach((input,time) => {
                points.push({position:[time,input[channel],-1],color:'#fbbf24',label:time === current ? 'Input' : undefined});
                for (let n = 0; n < 3; n++) {
                    const p: [number,number,number] = [time,trace.states[time][channel][n],n];
                    points.push({position:p,color:['#60a5fa','#2dd4bf','#a78bfa'][n],label:time === current ? `h${n + 1}: ${p[1].toFixed(2)}` : undefined});
                    paths.push({points:[[time,input[channel],-1],p],color:'#fbbf24',width:0.8});
                    if (time > 0) paths.push({points:[[time - 1,trace.states[time - 1][channel][n],n],p],color:'#2dd4bf',width:1 + trace.transitions[time][channel][n] * 2});
                }
            });
        } else if (mode === 'mamba3') {
            axes = ['real state coordinate 1','imaginary state coordinate 1','timestep']; description = 'A complex state rotates and decays. The first state component is shown in its real/imaginary plane with time on the third axis; all three complex components are computed.';
            const trajectory = trace.states.slice(0,current + 1).map((value,time) => [value[channel][0],trace.imaginary[time][channel][0],time] as [number,number,number]);
            paths.push({points:trajectory,color:'#a78bfa',width:3});
            trajectory.forEach((position,time) => points.push({position,color:time === current ? '#fbbf24' : '#a78bfa',label:time === current ? 'Current complex state' : undefined}));
        } else {
            axes = ['state coordinate 1','state coordinate 2','state coordinate 3']; description = 'The state trajectory uses actual three-coordinate hidden states for one selected channel. Retained memory and the new write add to the yellow current state.';
            const trajectory = trace.states.slice(0,current + 1).map(value => value[channel] as [number,number,number]);
            paths.push({points:trajectory,color:'#60a5fa',width:2});
            trajectory.forEach((position,time) => points.push({position,color:time === current ? '#fbbf24' : '#60a5fa',radius:time === current ? 0.13 : 0.07,label:time === current ? 'Current state' : undefined}));
            const retained = trace.retained[current][channel] as [number,number,number];
            vectors.push({from:[0,0,0],to:retained,color:'#a78bfa',label:'Retained'});
            vectors.push({from:retained,to:state as [number,number,number],color:'#2dd4bf',label:'New write'});
        }
        return {points,paths,vectors,boxes,axes,description};
    }, [view,dual,current,inputs,trace,channel,mode,state]);
    const explanation = <SceneExplanation title={TITLES[mode]} summary="A state summarizes previous inputs. Step through the recurrence and inspect the memory that is retained, written, and read.">
        <ExplanationSection title="What the coordinates mean"><p>{plot.description}</p><p>The model has three channels and three state components per channel. The channel selector chooses which state is displayed. Complex mode computes both real and imaginary components. Readout values can be positive or negative; they are not probabilities.</p></ExplanationSection>
        <ExplanationSection title="State-space foundation"><p>A discrete system updates hₜ = Aₜhₜ₋₁ + Bₜxₜ and reads yₜ = Cₜᵀhₜ. The foundation mode uses fixed demo B/C and exponential decay A. Increasing decay shortens memory; increasing the time step increases both forgetting and the current write. The initial state is zero.</p><p>Try the impulse input: only its first timestep is nonzero. The trajectory then reveals the system's memory directly. This is useful for filters, sensor dynamics, and streaming signals.</p></ExplanationSection>
        <ExplanationSection title="Selective memory"><p>Mamba's selective core makes Δ, B, and C depend on the current input. The selection-strength slider controls those explicit input projections. Set it to zero to obtain fixed parameters. Mamba-1 uses distinct diagonal decay rates across state components; Mamba-2 uses one scalar decay per channel, which supports a structured matrix representation.</p><p>This is the selective SSM core with demonstration parameters. Full Mamba blocks also include projections, gating and other architecture details; these weights are not trained for language or cue recall.</p><p><a href="https://arxiv.org/abs/2312.00752" target="_blank" rel="noreferrer">Mamba</a> · <a href="https://arxiv.org/abs/2405.21060" target="_blank" rel="noreferrer">Mamba-2</a></p></ExplanationSection>
        {mode === 'mamba2' && <ExplanationSection title="Recurrence and matrix form"><p>A past input's coefficient is CₜᵀBⱼ Δⱼ multiplied by the intervening decay factors. Future entries are zero. Computing this lower-triangular matrix times the inputs agrees with stepping the recurrence; the displayed error checks that equality. These coefficients are unnormalized and signed, so this is structured mixing rather than ordinary softmax attention.</p></ExplanationSection>}
        {mode === 'mamba3' && <ExplanationSection title="Complex exponential-trapezoidal core"><p>The transition decays and rotates a complex state. The recurrence also combines the previous forcing term with the current forcing term. Their coefficients are (1−λ)Δ exp(ΔA) and λΔ. λ=1 recovers exponential-Euler forcing; λ=0.5 averages endpoint contributions. MIMO writes and reads two streams through the same state matrix instead of one.</p><p>The rotation, interpolation and MIMO controls isolate these mechanisms in a small core. They do not reproduce a production Mamba-3 block or establish task quality. State storage includes the complex state and previous forcing needed for this recurrence.</p><p><a href="https://arxiv.org/abs/2603.15569" target="_blank" rel="noreferrer">Mamba-3 paper</a></p></ExplanationSection>}
        <ExplanationSection title="Assumptions and useful comparisons"><p>The input-dependent parameters are fixed functions of each input and all dynamics are stable exponential decays for positive decay. With zero decay the system can accumulate input. A finite state compresses history; its contents depend on the learned parameters in an actual model. Increase distractions, length, or decay and inspect the readout rather than assuming successful retrieval.</p><p>The byte estimate describes this numerical core's retained float32 state. Training activations and a complete network require additional storage. Comparing operation counts or state sizes does not measure hardware speed or predictive accuracy.</p></ExplanationSection>
    </SceneExplanation>;
    return <VisualLab title={TITLES[mode]} subtitle="Manipulate the dynamics, then follow what a streaming model remembers." explanation={explanation}
        metrics={[{label:'Readout',value:trace.outputs[current][channel].toFixed(3)},{label:'State norm',value:magnitude(mode === 'mamba3' ? [...state,...trace.imaginary[current][channel]] : state).toFixed(3)},
            ...(mode === 'mamba2' ? [{label:'Matrix / recurrence error',value:error.toExponential(1)}] : [{label:'Retained core state',value:`${trace.stateElements * 4} B`}])]}
        insight={`Step ${current + 1}: Δ=${trace.deltas[current][channel].toFixed(3)}, retention=[${trace.transitions[current][channel].map(value => value.toFixed(2)).join(', ')}]. ${mode === 'mamba3' ? 'The rotated state combines previous and current forcing.' : 'The retained state plus the current write gives the next state.'}`}
        challenge={mode === 'mamba3' ? 'Compare λ=1 and λ=0.5, then introduce rotation and a second input/output stream.' : 'Choose an impulse. Increase decay and inspect how quickly its influence disappears.'}
        controls={<>
            <LabSelect label="Input stream" value={kind} options={[{value:'cue',label:'Cue, distractions, read'},{value:'impulse',label:'One impulse then silence'},{value:'alternating',label:'Alternating signals'}]} onChange={value => setKind(value as 'cue'|'impulse'|'alternating')} />
            <LabSelect label="Space view" value={view} options={[{value:'state',label:mode === 'mamba3' ? 'Complex state trajectory' : 'State coordinate space'},{value:'flow',label:'Unrolled state flow'},...(mode !== 'mamba3' ? [{value:'matrix',label:'Structured mixing matrix'}] : [])]} onChange={setView} />
            <LabSelect label="Channel" value={String(channel)} options={[{value:'0',label:'Channel 1'},{value:'1',label:'Channel 2'},{value:'2',label:'Channel 3'}]} onChange={value => setChannel(Number(value))} />
            <LabRange label="Memory decay" value={decay} min={0} max={2} step={0.05} decimals={2} onChange={setDecay} />
            <LabRange label="Time step" value={stepSize} min={0.05} max={1.5} step={0.05} decimals={2} onChange={setStepSize} />
            {mode !== 'ssm' && <LabRange label="Input selection strength" value={selection} min={0} max={3} step={0.1} decimals={1} onChange={setSelection} />}
            <LabRange label="Distraction amplitude" value={noise} min={0} max={1} step={0.05} decimals={2} onChange={setNoise} />
            <LabRange label="Sequence length" value={length} min={6} max={24} step={2} onChange={setLength} />
            {mode === 'mamba3' && <><LabRange label="Complex rotation" value={angle} min={0} max={4} step={0.1} decimals={1} onChange={setAngle} /><LabRange label="Current endpoint weight λ" value={lambda} min={0} max={1} step={0.05} decimals={2} onChange={setLambda} /><button type="button" className="lab-button" aria-pressed={mimo} onClick={() => setMimo(!mimo)}>{mimo ? 'MIMO: two streams' : 'SISO: one stream'}</button></>}
            <LabPlayback step={current} max={length - 1} onStep={setStep} />
        </>}>
        <SpatialScene {...plot} equalScale={view === 'state' && mode !== 'mamba3'} equalAxes={mode === 'mamba3' && view === 'state' ? [0,1] : undefined} />
        <div className="visual-lab-overlay"><span>Selective SSM core · demo parameters</span><span>{mode === 'mamba3' ? mimo ? 'Complex MIMO' : 'Complex SISO' : 'Three actual state coordinates'}</span></div>
    </VisualLab>;
}
