import { VIZ } from '../../data/palette';
import { useMemo, useState } from 'react';
import { SpatialScene, type SpatialPath, type SpatialVector } from '../../components/3d/SpatialScene';
import { LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import { matrixDeterminant, multiplyMatrixVector, transformationMatrix, type Vector3Tuple } from './legacyLinearMath';

const CORNERS: Vector3Tuple[] = Array.from({ length: 8 }, (_, index) => [index & 1 ? 1 : -1, index & 2 ? 1 : -1, index & 4 ? 1 : -1]);
const EDGES = CORNERS.flatMap((_, index) => [1, 2, 4].flatMap(bit => index < (index ^ bit) ? [[index, index ^ bit] as const] : []));
const BASIS: Vector3Tuple[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const COLORS = [VIZ.basis1, VIZ.basis2, VIZ.basis3];

export default function MatrixTransformations() {
    const [scale, setScale] = useState<Vector3Tuple>([1, 1, 1]);
    const [angle, setAngle] = useState(0);
    const [shear, setShear] = useState(0.7);
    const [preset, setPreset] = useState('shear');
    const [corner, setCorner] = useState(7);
    const matrix = useMemo(() => transformationMatrix(scale, angle * Math.PI / 180, shear), [scale, angle, shear]);
    const transformed = useMemo(() => CORNERS.map(value => multiplyMatrixVector(matrix, value)), [matrix]);
    const determinant = matrixDeterminant(matrix);
    const scene = useMemo(() => {
        const paths: SpatialPath[] = EDGES.flatMap(([start, end]) => [
            { points: [CORNERS[start], CORNERS[end]], color: VIZ.axis, dashed: true },
            { points: [transformed[start], transformed[end]], color: VIZ.output, width: 2 },
        ]);
        const vectors: SpatialVector[] = BASIS.map((value, index) => ({ from: [0, 0, 0], to: multiplyMatrixVector(matrix, value), color: COLORS[index], label: `A e${index + 1}` }));
        vectors.push({ from: CORNERS[corner], to: transformed[corner], color: VIZ.focus, label: 'Corner Δ' });
        return { paths, vectors, points: [{ position: CORNERS[corner], color: VIZ.data, label: 'Input' }, { position: transformed[corner], color: VIZ.focus, label: 'Output' }] };
    }, [matrix, transformed, corner]);
    const choosePreset = (value: string) => {
        setPreset(value);
        if (value === 'custom') return;
        setScale(value === 'scale' ? [1.6, 0.7, 1.2] : value === 'reflection' ? [-1, 1, 1] : value === 'flatten' ? [1, 1, 0] : [1, 1, 1]);
        setAngle(value === 'rotation' ? 45 : 0);
        setShear(value === 'shear' ? 0.7 : 0);
    };
    const controls = <>
        <LabSelect label="Transformation preset" value={preset} options={[
            { value: 'identity', label: 'Identity' }, { value: 'scale', label: 'Unequal scaling' }, { value: 'rotation', label: 'Rotation about Z' },
            { value: 'shear', label: 'X shear from Y' }, { value: 'reflection', label: 'Reflection' }, { value: 'flatten', label: 'Flatten to a plane' }, { value: 'custom', label: 'Custom controls' },
        ]} onChange={choosePreset} />
        {scale.map((value, index) => <LabRange key={index} label={`Scale ${['X', 'Y', 'Z'][index]}`} value={value} min={-2} max={2} step={0.1} decimals={1} onChange={next => { setScale(current => current.map((entry, axis) => axis === index ? next : entry) as Vector3Tuple); setPreset('custom'); }} />)}
        <LabRange label="Z rotation degrees" value={angle} min={-180} max={180} step={5} onChange={value => { setAngle(value); setPreset('custom'); }} />
        <LabRange label="X shear from Y" value={shear} min={-2} max={2} step={0.1} decimals={1} onChange={value => { setShear(value); setPreset('custom'); }} />
        <LabSelect label="Inspect cube corner" value={String(corner)} options={CORNERS.map((value, index) => ({ value: String(index), label: `(${value.join(', ')})` }))} onChange={value => setCorner(Number(value))} />
        <details className="lab-panel"><summary>Computed matrix A</summary><table><tbody>{[0,1,2].map(row => <tr key={row}>{matrix.slice(3*row,3*row+3).map((value,column) => <td key={column}>{value.toFixed(2)}</td>)}</tr>)}</tbody></table></details>
    </>;
    const explanation = <SceneExplanation title="Matrix transformations" summary="A matrix maps each input vector to an output vector; its columns show where the basis vectors go.">
        <ExplanationSection title="Manipulate the space"><p>The dashed gray cube is the original. Purple edges connect the actual transformed corners. Red, green, and blue arrows are A e₁, A e₂, and A e₃: the matrix columns. Shear skews the cube without being a rotation. Linear maps keep the origin fixed and preserve vector addition.</p></ExplanationSection>
        <ExplanationSection title="Order and volume"><p>The displayed matrix is A = Rz Hx D: scale first, shear X by Y second, then rotate about Z. Changing order generally changes the result. The determinant is the signed volume factor; its absolute value multiplies volume. Negative determinant reverses orientation, and zero determinant collapses at least one dimension.</p></ExplanationSection>
        <ExplanationSection title="Uses and limits"><p>These operations underpin coordinate changes, feature scaling, image geometry, and feature-space reasoning in regression and SVM. This lab computes a family of 3×3 linear maps, not translations or every possible matrix. A rotation or shear does not by itself learn a representation from data.</p></ExplanationSection>
    </SceneExplanation>;
    return <VisualLab backUrl="/linear-algebra" title="Matrix transformations" subtitle="Change a matrix and watch its basis vectors and cube move together."
        legend={[{ label: 'Dashed cube', meaning: 'original space', color: VIZ.axis, shape: 'line' }, { label: 'Purple cube', meaning: 'transformed output', color: VIZ.output, shape: 'line' }, { label: 'e₁ / e₂ / e₃', meaning: 'coordinate basis images', color: VIZ.basis2, shape: 'line' }, { label: 'Gold', meaning: 'selected corner', color: VIZ.focus }]}
        controls={controls} explanation={explanation} metrics={[{ label: 'Determinant', value: determinant.toFixed(3) }, { label: 'Volume factor', value: Math.abs(determinant).toFixed(3) }, { label: 'Selected output', value: `(${transformed[corner].map(value => value.toFixed(2)).join(', ')})` }]}
        insight={`A = rotation × shear × scaling. ${Math.abs(determinant) < 1e-10 ? 'This matrix is singular: the cube loses a dimension.' : determinant < 0 ? 'Orientation is reversed.' : 'Orientation is preserved.'}`}
        challenge="Compare Shear with Rotation, then choose Flatten to a plane. Inspect the basis vectors and determinant.">
        <SpatialScene {...scene} axes={['coordinate X', 'coordinate Y', 'coordinate Z']} description="Original gray cube and its computed purple image under a 3 by 3 linear map. Colored arrows show transformed basis vectors; the yellow arrow tracks the selected corner." />

    </VisualLab>;
}
