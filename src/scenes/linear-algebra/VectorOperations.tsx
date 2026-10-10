import { useId, useMemo, useState } from 'react';
import { OrbitControls, Line } from '@react-three/drei';
import { Arrow } from '../../components/3d/Arrow';
import { Label } from '../../components/3d/Label';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { ExplanationSection, SceneExplanation, VisualLegend } from '../../components/layout/SceneExplanation';
import { useParams } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';

type VectorCoordinates = [number, number, number];

interface VectorAdditionSceneProps {
    vecA: VectorCoordinates;
    vecB: VectorCoordinates;
}

const COLORS = { a: '#a78bfa', b: '#60a5fa', sum: '#34d399', translated: '#94a3b8' };
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
    const controlsId = useId();
    const [vecA, setVecA] = useState<VectorCoordinates>([2, 1, 0]);
    const [vecB, setVecB] = useState<VectorCoordinates>([0, 2, 1]);
    const sum = useMemo(() => addVectors(vecA, vecB), [vecA, vecB]);
    const vectors = [
        { name: 'A', value: vecA, change: setVecA, color: COLORS.a },
        { name: 'B', value: vecB, change: setVecB, color: COLORS.b },
    ];

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
                <h2 style={{ fontSize: 18, marginBottom: 8 }}>Vector Addition</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    A vector describes a move in space. A + B is the move you get by following A, then B.
                    Its X, Y, and Z coordinates are added separately.
                </p>
            </div>

            {vectors.map(vector => (
                <fieldset key={vector.name} style={{ border: 0, minWidth: 0 }}>
                    <legend style={{ color: vector.color, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Vector {vector.name}</legend>
                    {AXES.map((axis, index) => {
                        const id = `${controlsId}-${vector.name}-${axis}`;
                        return (
                            <div key={axis} style={{ display: 'grid', gridTemplateColumns: '45px minmax(0, 1fr) 35px', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <label htmlFor={id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{vector.name} {axis}</label>
                                <input id={id} type="range" min="-3" max="3" step="0.1" value={vector.value[index]}
                                    onChange={event => {
                                        const next: VectorCoordinates = [...vector.value];
                                        next[index] = Number(event.target.value);
                                        vector.change(next);
                                    }}
                                    style={{ width: '100%', accentColor: vector.color, minHeight: 24 }} />
                                <output htmlFor={id} style={{ fontSize: 12, textAlign: 'right', color: 'var(--text-primary)' }}>{vector.value[index].toFixed(1)}</output>
                            </div>
                        );
                    })}
                </fieldset>
            ))}

            <div className="lab-stat">
                <span>Result: add matching coordinates</span>
                <output aria-label="Vector sum A plus B" aria-live="polite" style={{ display: 'block', marginTop: 8, color: COLORS.sum, fontFamily: 'monospace', fontSize: 15 }}>
                    A + B = {formatVector(sum)}
                </output>
                {isZero(sum) && <p className="lab-note">The vectors cancel: their combined move is zero.</p>}
            </div>

            <p className="lab-note">
                Change a coordinate and watch the endpoint move. Dashed segments show a copy of B starting at the tip of A
                and a copy of A starting at the tip of B. The green arrow reaches their shared endpoint.
            </p>
            <button type="button" className="lab-button" onClick={() => { setVecA([2, 1, 0]); setVecB([0, 2, 1]); }}>
                <RefreshCcw size={14} aria-hidden="true" /> Reset Vectors
            </button>
            <p className="lab-note">Drag the scene to rotate. Scroll or pinch to zoom. Sliders also work with arrow keys.</p>
        </GlassPane>
    );

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

    return (
        <SceneContainer backUrl={`/${topicId || 'linear-algebra'}`} controls={controls} explanation={explanation}>
            <SceneCanvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [6, 5, 6], fov: 50 }}
                aria-label="3D vector addition: arrows A and B, their sum, and dashed translated copies forming a parallelogram">
                <gridHelper args={[16, 16, '#475569', '#1e293b']} position={[0, -0.01, 0]} />
                <axesHelper args={[6]} />
                <VectorAdditionScene vecA={vecA} vecB={vecB} />
                <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={3} maxDistance={35} />
                <color attach="background" args={['#0b0f19']} />
            </SceneCanvas>
        </SceneContainer>
    );
}
