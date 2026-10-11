import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import Latex from '../../components/Latex';

const Z_SCALE = 0.15;
const bowl: LabVector[] = Array.from({ length: 41 * 41 }, (_, index) => {
    const x = -1 + 6 * (index % 41) / 40; const y = -1 + 6 * Math.floor(index / 41) / 40;
    return [x, (x * x + y * y) * Z_SCALE, y];
});
const constraint: LabVector[] = Array.from({ length: 121 }, (_, index) => {
    const t = -0.25 + 1.5 * index / 120; const x = 4 * t; const y = 4 * (1 - t);
    return [x, (x * x + y * y) * Z_SCALE + 0.06, y];
});

export default function LagrangeMultipliers() {
    const { topicId } = useParams();
    const [t, setT] = useState(0.8);
    const [showGradients, setShowGradients] = useState(true);
    const x = 4 * t; const y = 4 * (1 - t); const loss = x * x + y * y;
    const height = loss * Z_SCALE; const optimal = Math.abs(t - 0.5) < 1e-8;
    const normF = Math.hypot(2 * x, 2 * y);
    return <VisualLab title="Lagrange multipliers" subtitle="Find the lowest point on the allowed path. At the minimum, the two gradient directions align."
        backUrl={`/${topicId || 'ml'}`} metrics={[{ label: '(x, y)', value: `(${x.toFixed(2)}, ${y.toFixed(2)})` }, { label: 'Objective f', value: loss.toFixed(2) },
            { label: 'Constraint x + y', value: (x + y).toFixed(2) }, { label: 'df / dt', value: (64 * t - 32).toFixed(2) }, { label: 'λ at stationary point', value: optimal ? '4.00' : 'not stationary' }]}
        legend={[{ label: 'Bowl', meaning: 'objective height 0.15 × f', color: VIZ.output, shape: 'square' }, { label: 'Path', meaning: 'allowed points x + y = 4', color: VIZ.data, shape: 'line' },
            { label: 'Point', meaning: 'current feasible position', color: VIZ.focus }, { label: '∇f', meaning: 'objective gradient direction', color: VIZ.variation, shape: 'line' }, { label: '∇g', meaning: 'constraint normal direction', color: VIZ.truth, shape: 'line' }]}
        controls={<><LabRange label="Position on Path" value={t} min={0} max={1} step={0.01} decimals={2} onChange={setT} />
            <button className="lab-button" onClick={() => setT(0.5)}>Snap to Optimal Solution</button>
            <label className="lab-checkbox"><input type="checkbox" checked={showGradients} onChange={event => setShowGradients(event.target.checked)} />Show Floor Gradients</label></>}
        insight={optimal ? 'At (2, 2), f = 8 and ∇f = (4,4) = 4∇g. Moving either way along the path increases the objective.'
            : `Along the allowed path, df/dt = ${(64 * t - 32).toFixed(2)}. Move ${t > 0.5 ? 'backward' : 'forward'} to lower f; the minimum is where that derivative becomes zero.`}
        challenge="Find the position where the floor arrows point the same way before using Snap to Optimal Solution."
        explanation={<div className="lab-explanation"><Latex formula="\min f(x,y)=x^2+y^2\quad\text{subject to }g=x+y-4=0" display />
            <p>The parameterization x = 4t, y = 4(1−t) stays feasible. Stationarity requires ∇f = λ∇g, giving x = y = 2 and λ = 4.</p>
            <p>The objective height is rescaled by 0.15. Both floor arrows show normalized directions with the same displayed length; their lengths do not encode gradient magnitudes. Alignment is a necessary stationarity condition; convexity of this quadratic makes this stationary point the constrained global minimum.</p></div>}>
        <SpatialScene description="A quadratic bowl, the elevated feasible path x+y=4, and normalized objective and constraint gradient directions on the floor."
            axes={['input x', 'height 0.15 × f', 'input y']} surfaces={[{ vertices: bowl, columns: 41, color: VIZ.output, opacity: 0.25 }]}
            paths={[{ points: constraint, color: VIZ.data, width: 3 }, { points: [[x, height + 0.06, y], [x, 0, y]], color: VIZ.muted, dashed: true }]}
            points={[{ position: [x, height + 0.06, y], color: optimal ? VIZ.truth : VIZ.focus, radius: 0.16, label: optimal ? 'Minimum' : 'Current point' }]}
            vectors={showGradients ? [{ from: [x, 0.08, y], to: [x + 2.1 * 2 * x / normF, 0.08, y + 2.1 * 2 * y / normF], color: VIZ.variation, label: '∇f direction' },
                { from: [x, 0.08, y], to: [x + 2.1 / Math.SQRT2, 0.08, y + 2.1 / Math.SQRT2], color: VIZ.truth, label: '∇g direction' }] : []} />
    </VisualLab>;
}
