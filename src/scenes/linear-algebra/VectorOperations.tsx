import { useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import { Arrow } from '../../components/3d/Arrow';
import { Label } from '../../components/3d/Label';
import { SpatialScene } from '../../components/3d/SpatialScene';
import { VIZ } from '../../data/palette';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { ExplanationSection, SceneExplanation, VisualLegend } from '../../components/layout/SceneExplanation';
import { useParams } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';

type VectorCoordinates = [number, number, number];

interface VectorAdditionSceneProps {
    vecA: VectorCoordinates;
    vecB: VectorCoordinates;
}

const COLORS = { a: VIZ.data, b: VIZ.focus, sum: VIZ.output, translated: VIZ.axis };
const AXES = ['X', 'Y', 'Z'] as const;

function addVectors(a: VectorCoordinates, b: VectorCoordinates): VectorCoordinates {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function isZero(vector: VectorCoordinates): boolean {
    return vector.every(component => Math.abs(component) < 1e-8);
}

function formatVector(vector: VectorCoordinates): string {
    return `(${vector.map(component => component.toFixed(1)).join(', ')})`;
}

/** Static geometry: slider changes and OrbitControls invalidate a demand-rendered canvas. */
export function VectorAdditionScene({ vecA, vecB }: VectorAdditionSceneProps) {
    const sum = useMemo(() => addVectors(vecA, vecB), [vecA, vecB]);
    const translatedB = useMemo(() => [vecA, sum], [vecA, sum]);
    const translatedA = useMemo(() => [vecB, sum], [vecB, sum]);

    return (
        <group>
            <group name="vector-a">
                <Arrow end={vecA} color={COLORS.a} />
                <Label text={isZero(vecA) ? 'A = 0' : 'A'}
                    position={isZero(vecA) ? [-0.4, 0.3, 0] : [vecA[0] / 2, vecA[1] / 2 + 0.2, vecA[2] / 2]}
                    fontSize={0.65} color={COLORS.a} />
            </group>
            <group name="vector-b">
                <Arrow end={vecB} color={COLORS.b} />
                <Label text={isZero(vecB) ? 'B = 0' : 'B'}
                    position={isZero(vecB) ? [0.4, 0.6, 0] : [vecB[0] / 2, vecB[1] / 2 + 0.4, vecB[2] / 2]}
                    fontSize={0.65} color={COLORS.b} />
            </group>
            <group name="vector-sum">
                <Arrow end={sum} color={COLORS.sum} lineWidth={4} />
                <Label text={isZero(sum) ? 'A + B = 0' : 'A + B'}
                    position={isZero(sum) ? [0, 0.95, 0] : [sum[0], sum[1] + 0.25, sum[2]]}
                    fontSize={0.7} color={COLORS.sum} />
            </group>
            {!isZero(vecB) && <Line name="translated-b" points={translatedB} color={COLORS.translated} dashed dashSize={0.2} gapSize={0.1} opacity={0.65} transparent />}
            {!isZero(vecA) && <Line name="translated-a" points={translatedA} color={COLORS.translated} dashed dashSize={0.2} gapSize={0.1} opacity={0.65} transparent />}
        </group>
    );
}

export default function VectorOperations() {
    const { topicId } = useParams();
    const [vecA, setVecA] = useState<VectorCoordinates>([2, 1, 0]);
    const [vecB, setVecB] = useState<VectorCoordinates>([0, 2, 1]);
    const sum = useMemo(() => addVectors(vecA, vecB), [vecA, vecB]);
    const vectors = [
        { name: 'A', value: vecA, change: setVecA, color: COLORS.a },
        { name: 'B', value: vecB, change: setVecB, color: COLORS.b },
    ];

    const controls = <>
        {vectors.map(vector => AXES.map((axis, index) => <LabRange key={`${vector.name}-${axis}`} label={`${vector.name} ${axis}`}
            value={vector.value[index]} min={-3} max={3} step={0.1} decimals={1} onChange={value => {
                const next: VectorCoordinates = [...vector.value]; next[index] = value; vector.change(next);
            }} />))}
        <button type="button" className="lab-button" onClick={() => { setVecA([2, 1, 0]); setVecB([0, 2, 1]); }}>
            <RefreshCcw size={14} aria-hidden="true" /> Reset Vectors
        </button>
    </>;

    const explanation = (
        <SceneExplanation title="Vector Addition" summary="Add moves by placing the second arrow at the tip of the first. The result joins the starting point to the final endpoint.">
            <ExplanationSection title="What the coordinates mean">
                <p>In (X, Y, Z), each number tells you how far to move along that axis. A negative coordinate moves in the opposite direction. The zero vector represents no move.</p>
                <p>The starting example is A = (2, 1, 0) and B = (0, 2, 1), so A + B = (2 + 0, 1 + 2, 0 + 1) = (2, 3, 1).</p>
            </ExplanationSection>
            <ExplanationSection title="How to use this scene">
                <p>Change A X first to isolate one coordinate. Then change B Z to see a move out of the grid plane. Rotate the view to distinguish depth from height.</p>
                <p>Try B = −A. The arrows point in opposite directions with equal length, and the sum disappears because its length is zero. The numeric result still shows (0, 0, 0).</p>
            </ExplanationSection>
            <ExplanationSection title="Why the parallelogram works">
                <p>A moved copy of an arrow has the same coordinates and direction. The dashed copies meet at A + B. Taking B before A reaches the same point, so A + B = B + A.</p>
                <VisualLegend items={[
                    { label: 'A', description: 'First move from the origin.', color: COLORS.a },
                    { label: 'B', description: 'Second move, also shown from the origin.', color: COLORS.b },
                    { label: 'A + B', description: 'Combined move from the origin to the shared endpoint.', color: COLORS.sum },
                    { label: 'Dashed segments', description: 'Translated copies of the two original vectors.', color: COLORS.translated },
                ]} />
            </ExplanationSection>
        </SceneExplanation>
    );

    return <VisualLab title="Vector addition" backUrl={`/${topicId || 'linear-algebra'}`} controls={controls} explanation={explanation}
        subtitle="Place the second move at the tip of the first. Their shared endpoint is the sum."
        metrics={[{ label: 'A', value: formatVector(vecA) }, { label: 'B', value: formatVector(vecB) }, { label: 'A + B', value: formatVector(sum) }]}
        legend={[{ label: 'A', meaning: 'given first move', color: COLORS.a, shape: 'line' },
            { label: 'B', meaning: 'second move you can change', color: COLORS.b, shape: 'line' },
            { label: 'A + B', meaning: 'combined output', color: COLORS.sum, shape: 'line' },
            { label: 'Dashed', meaning: 'translated copies', color: COLORS.translated, shape: 'line' }]}
        insight={<><output aria-label="Vector sum A plus B">A + B = {formatVector(sum)}</output> {isZero(sum) && 'The vectors cancel: their combined move is zero.'}</>}
        challenge="Find a B that cancels A. Then reverse the moves: does the shared endpoint change?">
        <SpatialScene axes={['X coordinate', 'Y coordinate', 'Z coordinate']} equalScale
            description="3D vector addition: arrows A and B, their sum, and dashed translated copies forming a parallelogram"
            vectors={[{ from: [0,0,0], to: vecA, color: COLORS.a, label: isZero(vecA) ? 'A = 0' : 'A' },
                { from: [0,0,0], to: vecB, color: COLORS.b, label: isZero(vecB) ? 'B = 0' : 'B' },
                { from: [0,0,0], to: sum, color: COLORS.sum, label: isZero(sum) ? 'A + B = 0' : 'A + B' }]}
            paths={[{ points: [vecA,sum], color: COLORS.translated, dashed: true }, { points: [vecB,sum], color: COLORS.translated, dashed: true }]} />
    </VisualLab>;
}
