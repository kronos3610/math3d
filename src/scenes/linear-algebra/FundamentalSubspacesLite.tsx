import { useMemo, useState } from 'react';
import { SpatialScene, type LabVector, type SpatialVector } from '../../components/3d/SpatialScene';
import { LabRange, VisualLab } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { decomposeSubspaceInput } from './subspaceLiteMath';
import type { Vector3Tuple } from './legacyLinearMath';

const format = (vector: readonly number[]) => `(${vector.map(value => Math.abs(value) < 1e-10 ? '0.00' : value.toFixed(2)).join(', ')})`;
const ZERO: Vector3Tuple = [0, 0, 0];
const ROW_U: Vector3Tuple = [1 / Math.sqrt(5), 2 / Math.sqrt(5), 0];
const ROW_V: Vector3Tuple = [-2 / Math.sqrt(30), 1 / Math.sqrt(30), 5 / Math.sqrt(30)];

export default function FundamentalSubspacesLite() {
    const [input, setInput] = useState<Vector3Tuple>([3, 3, 3]);
    const decomposition = useMemo(() => decomposeSubspaceInput(input), [input]);
    const scene = useMemo(() => {
        const vectors: SpatialVector[] = [
            { from: ZERO, to: input, color: VIZ.data, label: 'input x' },
            { from: ZERO, to: decomposition.rowPart, color: VIZ.output, label: 'row part' },
            { from: ZERO, to: decomposition.nullPart, color: VIZ.variation, label: 'null part' },
            { from: decomposition.rowPart, to: input, color: VIZ.variation },
        ];
        const vertices: LabVector[] = [-1, 1].flatMap(v => [-1, 1].map(u => ROW_U.map((value, axis) => 4 * (u * value + v * ROW_V[axis])) as LabVector));
        return { vectors, surfaces: [{ vertices, columns: 2, color: VIZ.output, opacity: 0.22 }], paths: [
            { points: [[-4, 2, -2], [4, -2, 2]] as LabVector[], color: VIZ.variation, dashed: true },
            { points: [vertices[0], vertices[1], vertices[3], vertices[2], vertices[0]], color: VIZ.output, width: 1.5 },
        ] };
    }, [input, decomposition]);
    return <VisualLab backUrl="/linear-algebra" title="Row space + null space" subtitle="Move the input vector. Its perpendicular parts add back to the same vector."
        legend={[
            { label: 'x', meaning: 'input vector', color: VIZ.data, shape: 'line' },
            { label: 'Row part', meaning: 'component visible to A', color: VIZ.output, shape: 'square' },
            { label: 'Null part', meaning: 'component erased by A; dashed axis', color: VIZ.variation, shape: 'line' },
        ]}
        metrics={[{ label: 'Row part xᵣ', value: format(decomposition.rowPart) }, { label: 'Null part xₙ', value: format(decomposition.nullPart) }, { label: 'xᵣ · xₙ', value: Math.abs(decomposition.dot) < 1e-9 ? '0.000' : decomposition.dot.toFixed(3) }, { label: 'Reconstruction error', value: decomposition.reconstructionError.toFixed(3) }, { label: 'Ax', value: format(decomposition.output) }]}
        controls={<>{input.map((value, axis) => <LabRange key={axis} label={`Input x${axis + 1}`} value={value} min={-5} max={5} step={0.1} decimals={1} onChange={next => setInput(current => current.map((entry, i) => i === axis ? next : entry) as Vector3Tuple)} />)}
            <button type="button" className="lab-button" onClick={() => setInput([3, 3, 3])}>Reset input</button><button type="button" className="lab-button" onClick={() => setInput([2, -1, 1])}>Reveal a null direction</button></>}
        insight={`x = xᵣ + xₙ = ${format(input)}. The row plane is perpendicular to the dashed null line; A xₙ = ${format(decomposition.nullOutput)}. ${Math.hypot(...input) === 0 ? 'At zero, both parts and their arrows vanish.' : 'The translated null arrow completes the head-to-tail sum.'}`}
        challenge="Try to make the row part disappear without making x zero. Before revealing a null direction, predict what happens to Ax."
        explanation={<div className="lab-explanation"><h2>What the map can see</h2><p>A = [[1,2,0],[0,1,1],[1,3,1]]. Its null space is the line along n=(2,−1,1). Projecting x onto that line gives xₙ = ((x·n)/6)n. The remainder xᵣ=x−xₙ belongs to the row space. The two parts are perpendicular and their sum is exactly x.</p><p>Applying A erases the null part: Axₙ=0, so Ax=Axᵣ. Distinct inputs that differ only along the null line have the same output. This is why a rank-deficient system cannot recover every input coordinate from its output.</p><p>The shaded row plane and dashed null line are finite pieces of infinite subspaces; arrow positions use the original coordinate units with equal scaling. This lite scene focuses on the domain. The full Fundamental Subspaces lesson adds the column space and left null space in the codomain.</p></div>}>
        <SpatialScene {...scene} cameraPosition={[8, 4, -2]} axes={['input coordinate x₁', 'input coordinate x₂', 'input coordinate x₃']} description={`Input x ${format(input)} splits into row component ${format(decomposition.rowPart)} and null component ${format(decomposition.nullPart)}. Their dot product is zero; the shifted null arrow completes the sum.`} />
    </VisualLab>;
}
