import { useMemo, useState } from 'react';
import { VisualLab, LabRange, LabPlayback } from '../../components/layout/VisualLab';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { sampleHeightField } from '../../components/3d/height-field-geometry';
import { gradientDescentTrace, nonconvexLoss, nonconvexGradient } from '../../utils/optimization';
import { VIZ } from '../../data/palette';

const surface = { ...sampleHeightField(nonconvexLoss, 12, 48), color: VIZ.data, opacity: 0.35 };
export default function GradientDescentML() {
    const [rate,setRate] = useState(0.1);
    const [x,setX] = useState(3);
    const [y,setY] = useState(2);
    const [step,setStep] = useState(0);
    const trace = useMemo(() => gradientDescentTrace(nonconvexGradient,[x,y],{learningRate:rate,maxSteps:500}),[rate,x,y]);
    const k = Math.min(step,trace.path.length-1);
    const current = trace.path[k];
    const gradient = nonconvexGradient(...current);
    const points = trace.path.slice(0,k+1).map(([a,b]): LabVector => [a,nonconvexLoss(a,b),b]);
    return <VisualLab title="Gradient descent on a nonconvex loss" backUrl="/ml"
        subtitle="Change the start and step size to find different stationary points."
        controls={<><LabRange label="Learning rate" value={rate} min={0.02} max={2.4} step={0.02} decimals={2} onChange={value=>{setRate(value);setStep(0);}} />
            <LabRange label="Start x" value={x} min={-4} max={4} step={0.1} decimals={1} onChange={value=>{setX(value);setStep(0);}} />
            <LabRange label="Start y" value={y} min={-4} max={4} step={0.1} decimals={1} onChange={value=>{setY(value);setStep(0);}} />
            <LabPlayback step={k} max={trace.path.length-1} onStep={setStep} interval={120} />
            <LabRange label="Optimization step" value={k} min={0} max={trace.path.length-1} onChange={setStep} /></>}
        metrics={[{label:'Step k',value:k},{label:'Loss',value:nonconvexLoss(...current).toFixed(4)},{label:'Gradient norm',value:Math.hypot(...gradient).toFixed(4)},{label:'Position',value:`(${current.map(value=>value.toFixed(2)).join(', ')})`}]}
        legend={[{label:'Surface',meaning:'nonconvex objective',color:VIZ.data,shape:'square'},{label:'Gold',meaning:'visited updates and current point',color:VIZ.focus}]}
        insight={`Each update subtracts η=${rate.toFixed(2)} times the gradient. ${k<trace.path.length-1?'Step through the actual computed path.':trace.status==='converged'?'Gradient is small; a stationary point is reached.':trace.status==='diverged'?'The next update leaves the plotted ±6 domain; the run stopped.':'The iteration budget is exhausted.'}`}
        challenge="Compare two starting points at the same learning rate. Does a lower final loss prove a global minimum?"
        explanation={<div className="lab-explanation"><p>This illustrative objective combines a quadratic trend and sinusoidal ripples. Its exact analytic gradient drives every update. A small gradient can identify a stationary point; this method does not certify a global minimum.</p><p>Only finite iterates within ±6 are drawn. Input X/Z units are equal; the height axis is independently scaled. Playback respects Pause motion, while manual Step and sliders remain usable.</p></div>}>
        <SpatialScene surfaces={[surface]} paths={[{points,color:VIZ.focus,width:3}]} points={[{position:points[k],color:VIZ.focus,label:`k=${k}`,radius:0.13}]}
            equalScale={false} equalAxes={[0,2]} axes={['parameter x','loss L(x,y)','parameter y']} description="Computed gradient-descent updates on a nonconvex loss surface; move the start and learning rate to compare stationary points." />
    </VisualLab>;
}
