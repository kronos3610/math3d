import { useId, useState } from 'react';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { accumulate, sineAccumulation, sineAccumulationSlope } from './legacyCalculusMath';

const END = 2 * Math.PI;
const PX = (x: number) => 64 + x / END * 660;
const FY = (y: number) => 150 - y * 85;
const AY = (y: number) => 458 - y * 72;
const number = (value: number) => (Math.abs(value) < 0.00005 ? 0 : value).toFixed(4);
function curvePath(f: (x: number) => number, end: number, vertical: (y: number) => number) {
    return Array.from({ length: 161 }, (_, index) => { const x = end * index / 160; return `${index ? 'L' : 'M'}${PX(x)},${vertical(f(x))}`; }).join(' ');
}
function areaPath(a: number, b: number) {
    if (b <= a) return '';
    return `M${PX(a)},${FY(0)} ` + Array.from({ length: 101 }, (_, index) => { const x = a + (b - a) * index / 100; return `L${PX(x)},${FY(Math.sin(x))}`; }).join(' ') + ` L${PX(b)},${FY(0)} Z`;
}

export default function Integrals() {
    const id = useId();
    const [x, setX] = useState(Math.PI / 2);
    const [showBars, setShowBars] = useState(false);
    const [bars, setBars] = useState(24);
    const exact = sineAccumulation(x);
    const slope = Math.sin(x);
    const approximate = accumulate(Math.sin, 0, x, showBars ? bars : 400);
    const finiteDifference = sineAccumulationSlope(x);
    const dx = x / bars;
    const controls = <>
        <LabRange label="Accumulation endpoint x" value={x} min={0} max={END} step={0.01} decimals={2} onChange={setX} />
        <label className="lab-checkbox"><input type="checkbox" checked={showBars} onChange={event => setShowBars(event.target.checked)} />Show midpoint bars</label>
        {showBars && <LabRange label="Bars n" value={bars} min={4} max={100} step={1} onChange={setBars} />}
        <div className="lab-control-row">{[{ label: 'x=0', value: 0 }, { label: 'x=π', value: Math.PI }, { label: 'x=2π', value: END }].map(preset => <button type="button" className="lab-button" key={preset.label} onClick={() => setX(preset.value)}>{preset.label}</button>)}</div>
    </>;
    return <VisualLab title="Accumulation and its slope" subtitle="Move the upper limit: signed area becomes the height of A(x)." backUrl="/calculus" controls={controls}
        metrics={[{ label: 'A(x) midpoint sum', value: number(approximate) }, { label: 'A(x) exact', value: number(exact) }, { label: 'f(x)', value: number(slope) }, { label: 'A′(x) finite difference', value: number(finiteDifference) }]}
        legend={[{ label: 'f', meaning: 'sin x, the amount accumulated per unit x', color: VIZ.data, shape: 'line' }, { label: 'Positive', meaning: 'area adds to A', color: VIZ.truth, shape: 'square' }, { label: 'Negative', meaning: 'area subtracts from A', color: VIZ.error, shape: 'square' }, { label: 'A', meaning: 'accumulated signed area', color: VIZ.output, shape: 'line' }, { label: 'Endpoint', meaning: 'upper limit x and tangent to A', color: VIZ.focus }]}
        insight={`At x=${x.toFixed(2)} radians, A(x)=∫₀ˣ sin t dt=${number(exact)}. Its current slope ${number(finiteDifference)} matches f(x)=${number(slope)}. ${Math.abs(slope) < 1e-8 ? 'The instantaneous slope is zero here.' : x > Math.PI ? 'The new area is negative, so accumulation is decreasing.' : 'The new area is positive, so accumulation is increasing.'}`}
        challenge="Predict what happens after x passes π. Move all the way to 2π: why does a large shaded region have total signed area zero?"
        explanation={<div className="lab-explanation"><p>A(x)=∫₀ˣ sin t dt=1−cos x. Positive area raises A; negative area lowers it. The fundamental theorem says A′(x)=sin x=f(x). The moving tangent below shows that same rate.</p><p>The midpoint estimate uses 400 partitions by default, or the selected bar count when bars are shown. Thin visual spacing between bars is decorative; the sum uses their full mathematical widths. A′ is a centered finite difference of the exact accumulation with step 0.0001.</p></div>}>
        <div className="spatial-fallback"><svg className="lab-chart" viewBox="0 0 800 520" width="100%" height="100%" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
            <title id={`${id}-title`}>Function and linked accumulation</title><desc id={`${id}-desc`}>Top: sin x with signed area shaded from zero to {x.toFixed(2)}. Bottom: A(x)=1−cos x traced to the same endpoint, with tangent slope {slope.toFixed(4)}. Areas below zero subtract from the integral.</desc>
            <text x="64" y="28" fill={VIZ.text} fontSize="22">f(t)=sin t · signed area from 0 to x</text>
            <line x1="64" x2="735" y1={FY(0)} y2={FY(0)} stroke={VIZ.axis} /><line x1="64" x2="64" y1="48" y2="248" stroke={VIZ.axis} />
            <path d={areaPath(0, Math.min(x, Math.PI))} fill={VIZ.truth} fillOpacity="0.3" /><path d={areaPath(Math.PI, x)} fill={VIZ.error} fillOpacity="0.35" />
            {showBars && Array.from({ length: bars }, (_, index) => { const left = index * dx; const height = Math.sin(left + dx / 2); return <rect key={index} x={PX(left)} y={Math.min(FY(0), FY(height))} width={dx / END * 660 * 0.94} height={Math.abs(FY(height) - FY(0))} fill={VIZ.variation} fillOpacity="0.25" stroke={VIZ.variation} strokeWidth="0.6" />; })}
            <path d={curvePath(Math.sin, END, FY)} fill="none" stroke={VIZ.data} strokeWidth="3" />
            <line x1={PX(x)} x2={PX(x)} y1="48" y2="250" stroke={VIZ.focus} strokeDasharray="6 5" /><circle cx={PX(x)} cy={FY(slope)} r="6" fill={VIZ.focus} />
            <text x="28" y={FY(1) + 6} fill={VIZ.axis} fontSize="20">1</text><text x="18" y={FY(-1) + 6} fill={VIZ.axis} fontSize="20">−1</text>
            <text x="64" y="290" fill={VIZ.text} fontSize="22">A(x)=1−cos x · tangent slope = f(x)</text>
            <line x1="64" x2="735" y1={AY(0)} y2={AY(0)} stroke={VIZ.axis} /><line x1="64" x2="64" y1="307" y2="462" stroke={VIZ.axis} />
            <path d={curvePath(sineAccumulation, END, AY)} fill="none" stroke={VIZ.output} strokeOpacity="0.2" strokeWidth="2" /><path d={curvePath(sineAccumulation, x, AY)} fill="none" stroke={VIZ.output} strokeWidth="4" />
            <line x1={PX(Math.max(0, x - 0.55))} x2={PX(Math.min(END, x + 0.55))} y1={AY(exact + (Math.max(0, x - 0.55) - x) * slope)} y2={AY(exact + (Math.min(END, x + 0.55) - x) * slope)} stroke={VIZ.focus} strokeWidth="4" />
            <circle cx={PX(x)} cy={AY(exact)} r="6" fill={VIZ.focus} /><text x="30" y={AY(2) + 6} fill={VIZ.axis} fontSize="20">2</text>
            {[0, Math.PI, END].map((value, index) => <g key={value}><text x={PX(value)} y="271" textAnchor="middle" fill={VIZ.axis} fontSize="20">{['0', 'π', '2π'][index]}</text><text x={PX(value)} y="493" textAnchor="middle" fill={VIZ.axis} fontSize="20">{['0', 'π', '2π'][index]}</text></g>)}
            <text x="749" y="154" fill={VIZ.axis} fontSize="20">t</text><text x="749" y="461" fill={VIZ.axis} fontSize="20">x</text>
        </svg></div>
    </VisualLab>;
}
