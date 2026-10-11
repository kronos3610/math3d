import { useEffect, useMemo, useState } from 'react';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { PredictPrompt } from '../../components/layout/PredictPrompt';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { sampleHeightField } from '../../components/3d/height-field-geometry';
import { VIZ } from '../../data/palette';
import { gradientDescentTrace, quadraticGradient, quadraticLoss } from '../../utils/optimization';
import { useSceneMotion } from '../../hooks/useSceneMotion';

const surface = { ...sampleHeightField(quadraticLoss, 12, 36), color: VIZ.data, opacity: 0.3 };
const options = ['Converge without crossing the minimum', 'Reach the minimum in one update', 'Oscillate and converge', 'Oscillate without getting closer', 'Diverge', 'Stay at the minimum'] as const;

export default function GradientDescent() {
    const [rate, setRate] = useState(0.1);
    const [startX, setStartX] = useState(3);
    const [startY, setStartY] = useState(2);
    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const moving = useSceneMotion();
    const trace = useMemo(() => gradientDescentTrace(quadraticGradient, [startX, startY], { learningRate: rate }), [rate, startX, startY]);
    const currentStep = Math.min(step, trace.path.length - 1);
    const current = trace.path[currentStep];
    const active = playing && moving && currentStep < trace.path.length - 1;
    useEffect(() => {
        if (!active) return;
        const timer = window.setTimeout(() => setStep(value => Math.min(value + 1, trace.path.length - 1)), 300);
        return () => window.clearTimeout(timer);
    }, [active, currentStep, trace.path.length]);
    const factor = 1 - rate;
    const correct = startX === 0 && startY === 0 ? 5 : rate < 1 ? 0 : rate === 1 ? 1 : rate < 2 ? 2 : rate === 2 ? 3 : 4;
    const regime = options[correct];
    const paths = useMemo(() => [{ points: trace.path.slice(0, currentStep + 1).map(([x, y]): LabVector => [x, quadraticLoss(x, y), y]), color: VIZ.focus, width: 3 }], [trace.path, currentStep]);
    const status = currentStep < trace.path.length - 1 ? 'Ready for next update' : trace.status === 'diverged' ? 'Stopped: next update leaves ±6' : trace.status === 'max-steps' ? 'Step limit reached' : 'Converged';
    function resetRun() { setStep(0); setPlaying(false); setRevealed(false); }
    function changeRate(value: number) { setRate(value); resetRun(); }
    const controls = <>
        <LabRange label="Learning rate" value={rate} min={0.02} max={2.4} step={0.02} decimals={2} onChange={changeRate} />
        <LabRange label="Start x" value={startX} min={-4} max={4} step={0.1} decimals={1} onChange={value => { setStartX(value); resetRun(); }} />
        <LabRange label="Start y" value={startY} min={-4} max={4} step={0.1} decimals={1} onChange={value => { setStartY(value); resetRun(); }} />
        <div className="lab-control-row" role="group" aria-label="Learning rate presets">{[{ label: 'Too small', rate: 0.04 }, { label: 'Just right (η=1)', rate: 1 }, { label: 'Overshoots', rate: 1.5 }, { label: 'Diverges', rate: 2.2 }].map(preset => <button type="button" className="lab-button" key={preset.label} onClick={() => changeRate(preset.rate)}>{preset.label}</button>)}</div>
        <div className="visual-lab-playback" role="group" aria-label="Experiment playback">
            <button type="button" className="lab-button" disabled={currentStep >= trace.path.length - 1} onClick={() => { setPlaying(false); setStep(value => Math.min(value + 1, trace.path.length - 1)); }}>Step</button>
            <button type="button" className="lab-button" disabled={!moving} aria-pressed={active} onClick={() => { if (active) setPlaying(false); else { if (currentStep >= trace.path.length - 1) setStep(0); setPlaying(true); } }}>{active ? 'Pause' : 'Play'}</button>
            <button type="button" className="lab-button" onClick={() => { setStep(0); setPlaying(true); setRevealed(true); }}>Replay</button>
            <button type="button" className="lab-button" onClick={resetRun}>Reset</button>
            <span>Step {currentStep} / {trace.path.length - 1}</span>{!moving && <span>Motion paused · Step remains available</span>}
        </div>
    </>;
    return <VisualLab title="Gradient descent" subtitle="Move the starting point; choose how far each update travels down the quadratic bowl." backUrl="/calculus" controls={controls}
        metrics={[{ label: 'Step k', value: currentStep }, { label: 'Position (x, y)', value: `(${current[0].toFixed(3)}, ${current[1].toFixed(3)})` }, { label: 'Loss f', value: quadraticLoss(...current).toFixed(4) }, { label: 'Gradient norm', value: Math.hypot(...current).toFixed(4) }, { label: 'Status', value: status }]}
        legend={[{ label: 'Bowl', meaning: 'f(x,y)=½(x²+y²)', color: VIZ.data, shape: 'square' }, { label: 'Current', meaning: 'selected iterate and visited path', color: VIZ.focus }, { label: 'Minimum', meaning: 'zero loss at the origin', color: VIZ.truth }]}
        insight={revealed || currentStep > 0 ? `${regime}. Each coordinate is multiplied by ${factor.toFixed(2)} per update; distance is multiplied by ${Math.abs(factor).toFixed(2)}.` : `Choose a rate and predict, skip, or Step to inspect the update. Each coordinate will be multiplied by 1−η=${factor.toFixed(2)}.`}
        challenge="Set η=1, then Step. Try η=1.5 and η=2.2 from the same start to see overshooting converge or escape."
        prediction={<PredictPrompt question={`With η=${rate.toFixed(2)} from (${startX.toFixed(1)}, ${startY.toFixed(1)}), what will happen?`} options={options} correct={correct} contextKey={`${rate}/${startX}/${startY}`} persistenceKey="calculus-gradient-descent" explanation={`The update is (x,y) ← ${factor.toFixed(2)}(x,y). ${regime}.`} onReveal={() => { setRevealed(true); setStep(Math.min(1, trace.path.length - 1)); setPlaying(true); }} />}
        explanation={<div className="lab-explanation"><p>For f(x,y)=½(x²+y²), the gradient is (x,y). Subtracting η times that gradient multiplies each coordinate by 1−η. Between 0 and 1 the point approaches without crossing; at 1 it lands in one update; between 1 and 2 it alternates and approaches; at 2 its distance stays unchanged; above 2 it escapes unless it starts at the minimum.</p><p>Only actual finite iterates are drawn. A run stops before leaving the plotted input domain ±6, or after 160 updates. Step remains usable when global motion is paused. Height and input axes are scaled separately; X/Z preserve the same input units.</p></div>}>
        <SpatialScene surfaces={[surface]} paths={paths} points={[{ position: [0, 0, 0], color: VIZ.truth, label: 'Minimum' }, { position: [current[0], quadraticLoss(...current), current[1]], color: VIZ.focus, label: `k=${currentStep}`, radius: 0.13 }]} axes={['input x', 'loss f(x,y)', 'input y']} equalScale={false} equalAxes={[0, 2]} description={`Quadratic loss bowl and ${currentStep} gradient descent updates. Current position (${current[0].toFixed(3)}, ${current[1].toFixed(3)}), loss ${quadraticLoss(...current).toFixed(4)}. ${status}.`} />
    </VisualLab>;
}
