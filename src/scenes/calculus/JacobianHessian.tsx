import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { sineCosineSurface as f, sineCosineGradient as getJacobian, sineCosineHessian as getHessian, sineCosineTaylor } from './legacyCalculusMath';

const surfaceVertices: LabVector[] = Array.from({ length: 61 * 61 }, (_, index) => {
    const x = -4 + 8 * (index % 61) / 60; const y = -4 + 8 * Math.floor(index / 61) / 60;
    return [x, f(x, y), y];
});
export default function JacobianHessian() {
    const { topicId } = useParams();
    const [coords, setCoords] = useState({ x: 0.5, y: 0.5 });
    const [showJacobian, setShowJacobian] = useState(true);
    const [showHessian, setShowHessian] = useState(true);
    const [resetCount, setResetCount] = useState(0);
    const [dfdx, dfdy] = getJacobian(coords.x, coords.y);
    const h = getHessian(coords.x, coords.y);
    const localVertices = useMemo(() => Array.from({ length: 21 * 21 }, (_, index): LabVector => {
        const dx = -0.75 + 1.5 * (index % 21) / 20; const dy = -0.75 + 1.5 * Math.floor(index / 21) / 20;
        return [coords.x + dx, sineCosineTaylor(coords.x, coords.y, dx, dy) + 0.05, coords.y + dy];
    }), [coords.x, coords.y]);
    const height = f(coords.x, coords.y);
    return <VisualLab title="Jacobian and Hessian" subtitle="Slope points uphill; curvature shapes the local quadratic approximation. f(x,y) = sin(x)cos(y)."
        backUrl={`/${topicId || 'calculus'}`} metrics={[{ label: 'f(x,y)', value: height.toFixed(3) }, { label: 'Gradient J', value: `[${dfdx.toFixed(2)}, ${dfdy.toFixed(2)}]` },
            { label: 'Hessian row 1', value: `[${h[0][0].toFixed(2)}, ${h[0][1].toFixed(2)}]` }, { label: 'Hessian row 2', value: `[${h[1][0].toFixed(2)}, ${h[1][1].toFixed(2)}]` }]}
        legend={[{ label: 'Input x', meaning: 'input x', color: VIZ.axis, shape: 'line' }, { label: 'Input y', meaning: 'input y on the floor', color: VIZ.axis, shape: 'line' }, { label: 'Height', meaning: 'vertical f(x, y)', color: VIZ.axis, shape: 'line' },
            { label: 'Surface', meaning: 'original function', color: VIZ.truth, shape: 'square' }, { label: 'J arrow', meaning: 'gradient in the input plane', color: VIZ.data, shape: 'line' }, { label: 'H patch', meaning: 'local quadratic output', color: VIZ.output, shape: 'square' }]}
        controls={<><LabRange label="Coordinate X" value={coords.x} min={-3} max={3} step={0.1} decimals={1} onChange={x => setCoords(previous => ({ ...previous, x }))} />
            <LabRange label="Coordinate Y" value={coords.y} min={-3} max={3} step={0.1} decimals={1} onChange={y => setCoords(previous => ({ ...previous, y }))} />
            <label className="lab-checkbox"><input type="checkbox" checked={showJacobian} onChange={event => setShowJacobian(event.target.checked)} />Show Jacobian (Gradient)</label>
            <label className="lab-checkbox"><input type="checkbox" checked={showHessian} onChange={event => setShowHessian(event.target.checked)} />Show Hessian (Curvature)</label>
            <button className="lab-button" onClick={() => { setCoords({ x: 0.5, y: 0.5 }); setResetCount(count => count + 1); }}>Reset</button></>}
        insight={`At (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)}), moving along J increases f fastest. The patch uses the full Hessian, including mixed curvature ${h[0][1].toFixed(2)}.`}
        challenge="Move to x = 0, y = 0. The slope is nonzero but the Hessian is zero. What does the local quadratic patch look like?"
        explanation={<div className="lab-explanation"><p>The Jacobian of this scalar function is its gradient: [cos(x)cos(y), −sin(x)sin(y)]. The Hessian collects all second derivatives, including both mixed entries.</p>
            <p>The patch is f + J·Δ + ½ΔᵀHΔ over offsets within ±0.75, lifted by 0.05 only to separate overlapping surfaces. The gradient arrow has its exact input-space magnitude, drawn horizontally at the point's height. It is not a tangent vector to the embedded surface. The patch is local and is not an exact replacement for f away from the point.</p></div>}>
        <SpatialScene key={resetCount} axes={['input x', 'vertical f(x, y)', 'input y on the floor']}
            description="The actual sine-cosine surface, a selected point, its horizontal gradient arrow, and its second-order Taylor patch."
            surfaces={[{ vertices: surfaceVertices, columns: 61, color: VIZ.truth, opacity: 0.3 }, ...(showHessian ? [{ vertices: localVertices, columns: 21, color: VIZ.output, opacity: 0.65 }] : [])]}
            points={[{ position: [coords.x, height, coords.y], color: VIZ.focus, radius: 0.12, label: 'Current point' }]}
            vectors={showJacobian ? [{ from: [coords.x, height + 0.05, coords.y], to: [coords.x + dfdx, height + 0.05, coords.y + dfdy], color: VIZ.data, label: 'J' }] : []} />
    </VisualLab>;
}
