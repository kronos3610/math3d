import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VisualLab, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { radialNormShrink } from './regularizationModel';

const DESC: Record<string, string> = {
    '1': 'The L1 ball is an octahedron with vertices on the coordinate axes. A solved L1-constrained objective can have zero coefficients; this radial illustration does not create sparsity by itself.',
    '2': 'The L2 ball is a sphere. This illustration scales all coordinates equally along a ray; a general ridge-regression fit need not shrink them equally.',
    '3': 'As p increases, the norm ball transitions from an octahedron toward a cube.',
    'Infinity': 'L-Infinity (Max) creates a box that caps the absolute maximum value of any weight.',
};
const norm = (weights: LabVector, p: number) => p === Infinity ? Math.max(...weights.map(Math.abs)) : weights.reduce((sum, weight) => sum + Math.abs(weight) ** p, 0) ** (1 / p);
const tuple = (weights: readonly number[]) => `(${weights.map(value => value.toFixed(2)).join(', ')})`;

export default function LpRegularization() {
    const { topicId } = useParams();
    const [pValue, setPValue] = useState(2);
    const [radius, setRadius] = useState(1.2);
    const [weights, setWeights] = useState<LabVector>([2.8, 2.2, 2]);
    const radial = radialNormShrink(weights, pValue, radius) as LabVector;
    const vertices = useMemo(() => {
        if (pValue === Infinity) return [];
        return Array.from({ length: 41 * 41 }, (_, index): LabVector => {
            const v = Math.floor(index / 41) / 40 * Math.PI; const u = index % 41 / 40 * 2 * Math.PI;
            const direction: LabVector = [Math.sin(v) * Math.cos(u), Math.sin(v) * Math.sin(u), Math.cos(v)];
            const denominator = norm(direction, pValue) || 1;
            return direction.map(value => value / denominator * radius) as LabVector;
        });
    }, [pValue, radius]);
    const label = pValue === Infinity ? '∞' : String(pValue);
    const feasible = norm(weights, pValue) <= radius;
    return <VisualLab title="Lp norm geometry" subtitle="Change the norm and budget. The allowed weight region changes shape; the selected ray meets its boundary."
        backUrl={`/${topicId || 'ml'}`} metrics={[{ label: `Input ‖β‖${label}`, value: norm(weights, pValue).toFixed(3) }, { label: 'Budget t', value: radius.toFixed(2) },
            { label: 'Radial output', value: tuple(radial) }, { label: 'Output norm', value: norm(radial, pValue).toFixed(3) }]}
        legend={[{ label: 'Norm ball', meaning: 'allowed weights ‖β‖p ≤ t', color: VIZ.output, shape: 'square' }, { label: 'Input β', meaning: 'given weight vector', color: VIZ.data },
            { label: 'Radial output', meaning: 'current ray intersection', color: VIZ.focus }, { label: 'Ray', meaning: 'common scaling of all coordinates', color: VIZ.variation, shape: 'line' }]}
        controls={<><LabSelect label="Norm p" value={String(pValue)} options={[{ value: '1', label: 'L1 (octahedron)' }, { value: '2', label: 'L2 (sphere)' }, { value: '3', label: 'L3' }, { value: 'Infinity', label: 'L∞ (cube)' }]}
            onChange={value => setPValue(Number(value))} />
            <LabRange label="Radius / budget" value={radius} min={0.1} max={5} step={0.1} decimals={1} onChange={setRadius} />
            <details className="lab-panel"><summary>Input weight coordinates</summary>{weights.map((value, axis) => <LabRange key={axis} label={`Weight β${axis + 1}`} value={value} min={-4} max={4} step={0.1} decimals={1}
                onChange={next => setWeights(current => current.map((entry, index) => index === axis ? next : entry) as LabVector)} />)}</details></>}
        insight={feasible ? `The input already satisfies the L${label} budget, so the radial output equals the input.` : `Every coefficient is multiplied by ${(radius / norm(weights, pValue)).toFixed(3)} until the output norm equals the budget.`}
        challenge="Switch L2 to L1 without changing the budget. Why does the same positive input ray stop closer to the origin?"
        explanation={<div className="lab-explanation"><p>{DESC[String(pValue)]}</p><p>The computed output is β × min(1, t/‖β‖p). It is a radial intersection, not nearest-point projection and not a fitted regularized regression. Use Ridge &amp; Lasso Constraints to see solved objectives and actual sparse solutions.</p></div>}>
        <SpatialScene axes={['weight β₁', 'weight β₂', 'weight β₃']} description={`The L${label} weight ball, input weights, and their radial intersection with the budget. All coordinate axes have equal units.`}
            surfaces={vertices.length ? [{ vertices, columns: 41, color: VIZ.output, opacity: 0.25 }] : []}
            boxes={pValue === Infinity ? [{ position: [0, 0, 0], size: [2 * radius, 2 * radius, 2 * radius], color: VIZ.output, opacity: 0.15 }] : []}
            points={[{ position: weights, color: VIZ.data, radius: 0.12, label: 'Input β' }, { position: radial, color: VIZ.focus, radius: 0.14, label: 'Radial output' }]}
            paths={[{ points: [[0, 0, 0], weights], color: VIZ.variation, dashed: true }]} />
    </VisualLab>;
}
