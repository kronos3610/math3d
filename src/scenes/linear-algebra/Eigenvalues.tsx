import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { PredictPrompt } from '../../components/layout/PredictPrompt';
import { VIZ } from '../../data/palette';
import { seededRandom } from '../../utils/regression';
import { assessEigenvector, eigenAlignment, fibonacciSphere, multiplyMatrixVector, type Matrix3Tuple, type Vector3Tuple } from './legacyLinearMath';

const START_MATRIX: Matrix3Tuple = [2, 0, 0, 0, 1.5, 0, 0, 0, 0.5];
const IDENTITY_MATRIX: Matrix3Tuple = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const ROTATION_MATRIX: Matrix3Tuple = [0, -1, 0, 1, 0, 0, 0, 0, 1];
const directions = [...fibonacciSphere(300), [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as Vector3Tuple[];
const tuple = (vector: Vector3Tuple) => `(${vector.map(value => value.toFixed(2)).join(', ')})`;

export default function Eigenvalues() {
    const { topicId } = useParams();
    const [matrix, setMatrix] = useState<Matrix3Tuple>(START_MATRIX);
    const [matrixDraft, setMatrixDraft] = useState(START_MATRIX.map(String));
    const [vector, setVector] = useState<Vector3Tuple>([1, 1, 1]);
    const [showMap, setShowMap] = useState(true);
    const [randomSeed, setRandomSeed] = useState(14);
    const [resetRevision, setResetRevision] = useState(0);
    const result = multiplyMatrixVector(matrix, vector);
    const assessment = assessEigenvector(vector, result);
    const inputLength = Math.hypot(...vector);
    const outputLength = Math.hypot(...result);
    const rotation = matrix.every((value, index) => value === ROTATION_MATRIX[index]);
    const rotationAxis = assessEigenvector([0, 0, 1], multiplyMatrixVector(matrix, [0, 0, 1]));
    const rotationPlane = assessEigenvector([1, 0, 0], multiplyMatrixVector(matrix, [1, 0, 0]));
    const alignment = useMemo(() => directions.map(direction => {
        const value = eigenAlignment(matrix, direction);
        const color = new THREE.Color(VIZ.muted).lerp(new THREE.Color(VIZ.focus), value ** 64);
        return { position: direction.map(coordinate => coordinate * 2) as LabVector, color: color.getStyle(), radius: 0.06 + 0.06 * value ** 64 };
    }), [matrix]);
    const setExample = (example: Matrix3Tuple, map = true) => {
        setMatrix(example); setMatrixDraft(example.map(String)); setShowMap(map);
        if (!map) setResetRevision(revision => revision + 1);
    };
    const updateMatrix = (index: number, draft: string) => {
        setMatrixDraft(current => current.map((value, i) => i === index ? draft : value));
        const value = Number(draft);
        if (!draft.trim() || !Number.isFinite(value)) return;
        setMatrix(current => current.map((entry, i) => i === index ? Math.max(-10, Math.min(10, value)) : entry) as Matrix3Tuple);
        setShowMap(true);
    };
    const reset = () => { setExample(START_MATRIX); setVector([1, 1, 1]); setResetRevision(value => value + 1); };
    const revealDominant = () => {
        let next: Vector3Tuple = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
        for (let step = 0; step < 80; step++) {
            const image = multiplyMatrixVector(matrix, next); const length = Math.hypot(...image);
            if (length === 0) break;
            next = image.map(value => value / length) as Vector3Tuple;
        }
        setVector(next.map(value => value * 2) as Vector3Tuple); setShowMap(true);
    };
    const direction = inputLength > 0 ? vector.map(value => value / inputLength * Math.max(2.2, outputLength)) as LabVector : [0, 0, 0] as LabVector;
    return <VisualLab title={assessment.isEigen ? 'Approximate eigenvector found' : 'Find an eigen-direction'}
        subtitle="Move the input toward a bright spot. An eigenvector keeps its line after transformation."
        backUrl={`/${topicId || 'linear-algebra'}`}
        metrics={[{ label: 'Input x', value: tuple(vector) }, { label: 'Output Ax', value: tuple(result) },
            { label: '|Ax| / |x|', value: inputLength ? (outputLength / inputLength).toFixed(3) : 'undefined' },
            { label: 'Normalized residual', value: Number.isFinite(assessment.residual) ? assessment.residual.toExponential(2) : 'undefined for a zero input' }]}
        legend={[{ label: 'Input x', meaning: 'given vector', color: VIZ.data, shape: 'line' }, { label: 'Ax', meaning: 'transformed output', color: VIZ.output, shape: 'line' },
            { label: 'Bright spots', meaning: 'near parallel, including reversal', color: VIZ.focus }, { label: 'Dim spots', meaning: 'directions that turn', color: VIZ.muted }]}
        controls={<>
            {vector.map((value, axis) => <LabRange key={axis} label={`Input vector ${['X', 'Y', 'Z'][axis]}`} value={value} min={-3} max={3} step={0.1} decimals={1}
                onChange={next => setVector(current => current.map((entry, index) => index === axis ? next : entry) as Vector3Tuple)} />)}
            <div className="lab-control-row" role="group" aria-label="Matrix presets">
                <button className="lab-button" onClick={reset}>Reset</button>
                <button className="lab-button" onClick={() => setExample(IDENTITY_MATRIX)}>Identity</button>
                <button className="lab-button" onClick={() => setExample(START_MATRIX)}>Scale</button>
                <button className="lab-button" onClick={() => setExample([1, 1, 0, 0, 1, 0, 0, 0, 1])}>Shear</button>
                <button className="lab-button" onClick={() => setExample(ROTATION_MATRIX, false)}>Rotation</button>
                <button className="lab-button" onClick={() => {
                    const random = seededRandom(randomSeed); setRandomSeed(seed => seed + 1);
                    setExample(Array.from({ length: 9 }, () => Math.round((random() * 2 - 1) * 10) / 10) as Matrix3Tuple);
                }}>Random</button>
            </div>
            <button className="lab-button" onClick={revealDominant}>Reveal dominant eigenvector</button>
            <details className="lab-panel"><summary>Edit matrix A</summary><div className="lab-matrix-grid">{matrixDraft.map((draft, index) => <input key={index} type="number" step="0.1" min="-10" max="10"
                aria-label={`Matrix entry row ${Math.floor(index / 3) + 1} column ${index % 3 + 1}`} value={draft}
                onChange={event => updateMatrix(index, event.target.value)} onBlur={() => setMatrixDraft(matrix.map(String))} />)}</div></details>
        </>}
        insight={assessment.isEigen ? `Estimated eigenvalue λ = ${assessment.lambda?.toFixed(2)}. Ax = ${assessment.lambda?.toFixed(2)}·x: ${assessment.lambda === 0 ? 'the vector is sent to zero' : (assessment.lambda ?? 0) < 0 ? 'its line is preserved and direction reverses' : 'its line is preserved'}.`
            : inputLength === 0 ? 'A zero input has no direction and is never an eigenvector.' : `Ax turns away from x. The signed projection factor is ${assessment.lambda?.toFixed(3)}; it becomes an eigenvalue only when the residual vanishes.`}
        challenge="Find the three bright lines for Scale, then try Shear. Why does its map show a whole circle of eigen-directions?"
        prediction={rotation && <PredictPrompt question="How many real eigen-directions does a 90° rotation about Z have?"
            options={['One line: the Z axis', 'Two lines in the XY plane', 'Every direction is an eigen-direction']}
            correct={rotationAxis.isEigen && !rotationPlane.isEigen ? 0 : 2} contextKey={`rotation-${resetRevision}`} persistenceKey="eigenvalues"
            explanation="The XY plane turns by 90°, so no nonzero vector there stays on its line. The Z axis stays fixed: λ = 1. Two poles on the map represent one line."
            onReveal={() => setShowMap(true)} />}
        explanation={<div className="lab-explanation"><p>A nonzero vector is an eigenvector when Ax = λx; λ can be negative or zero. The map samples 306 unit directions, using |cos(angle)| as its brightness. A zero image is fully aligned because λ = 0 is valid.</p>
            <p>The map is sampled, so bright neighborhoods are hints; the probe's normalized residual is the exact check, with tolerance 10⁻⁶. For the shear shown here, the y = 0 plane is an eigenplane. These are eigen-directions, not an ellipsoid's axes, which would be singular vectors for a general matrix.</p>
            <p>Reveal dominant eigenvector attempts 80 power iterations and may not converge for rotations or equal-magnitude eigenvalues. Identity is a separate solved example; Reset restores the unsolved starting matrix.</p></div>}>
        <SpatialScene fitPoints={showMap} axes={['coordinate 1', 'coordinate 2', 'coordinate 3']} description={`Input x and transformed Ax with ${showMap ? 'a sampled alignment map; bright directions preserve their line' : 'the alignment map hidden until the prediction is revealed'}.`}
            points={showMap ? alignment : []} vectors={[{ from: [0, 0, 0], to: vector, color: VIZ.data, label: 'x' }, { from: [0, 0, 0], to: result, color: assessment.isEigen ? VIZ.focus : VIZ.output, label: 'Ax' }]}
            paths={assessment.isEigen ? [{ points: [direction.map(value => -value) as LabVector, direction], color: VIZ.focus, dashed: true }] : []} />
    </VisualLab>;
}
