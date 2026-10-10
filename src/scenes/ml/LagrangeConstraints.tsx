import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { FitSceneCamera } from '../../components/3d/FitSceneCamera';
import { useState, useMemo, useEffect } from 'react';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';
import { QUADRATIC_CENTER, QUADRATIC_CURVATURE, quadraticWeightLoss, solveBudgetQuadratic } from './regularizationModel';

// The chosen diagonal quadratic has this unconstrained minimum.
const OLS_POS = new THREE.Vector3(...QUADRATIC_CENTER);
const ORIGIN = new THREE.Vector3(0, 0, 0);
const CONSTRAINT_CAMERA = { position: [10, 8, 12] as [number, number, number], fov: 50 };
// Includes all budgets up to eight and the largest quadratic contour (at zero budget).
const MAX_CONTOUR = QUADRATIC_CURVATURE.map(value => Math.sqrt(2 * quadraticWeightLoss([0, 0, 0]) / value));
const CONSTRAINT_BOUNDS = { minimum: [-8.2, -8.2, -8.2] as const, maximum: QUADRATIC_CENTER.map((value, axis) => Math.max(8.2, value + MAX_CONTOUR[axis] + 0.2)) as [number, number, number] };

// --- Sub-components ---

function ConstraintShape({ mode, budgetT }: { mode: 'ridge' | 'lasso'; budgetT: number }) {
    const color = mode === 'ridge' ? '#10b981' : '#f59e0b';
    const edgeColor = mode === 'ridge' ? '#059669' : '#d97706';

    const { geometry, edges } = useMemo(() => {
        const geo = mode === 'ridge'
            ? new THREE.SphereGeometry(budgetT, 40, 40)
            : new THREE.OctahedronGeometry(budgetT, 0);
        return { geometry: geo, edges: new THREE.EdgesGeometry(geo) };
    }, [mode, budgetT]);
    useEffect(() => () => { geometry.dispose(); edges.dispose(); }, [geometry, edges]);

    return (
        <group>
            <mesh geometry={geometry}>
                <meshPhongMaterial
                    color={color}
                    transparent
                    opacity={0.35}
                    shininess={60}
                    flatShading={mode === 'lasso'}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <lineSegments geometry={edges}>
                <lineBasicMaterial color={edgeColor} transparent opacity={0.5} />
            </lineSegments>
        </group>
    );
}

function DashedLine({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
    const lineObj = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineDashedMaterial({ color: '#94a3b8', dashSize: 0.2, gapSize: 0.1 });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        return line;
    }, [start, end]);
    useEffect(() => () => { lineObj.geometry.dispose(); (lineObj.material as THREE.Material).dispose(); }, [lineObj]);
    return <primitive object={lineObj} />;
}

function Scene({ mode, budgetT }: { mode: 'ridge' | 'lasso'; budgetT: number }) {
    const solution = useMemo(() => solveBudgetQuadratic(mode, budgetT), [mode, budgetT]);
    const solutionPoint = useMemo(() => new THREE.Vector3(...solution), [solution]);
    const loss = quadraticWeightLoss(solution);
    const contourScale = QUADRATIC_CURVATURE.map(value => Math.sqrt(2 * loss / value)) as [number, number, number];

    return (
        <>
            <FitSceneCamera bounds={CONSTRAINT_BOUNDS} />
            <color attach="background" args={['#0b0f19']} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />

            <OrbitControls makeDefault />

            <gridHelper args={[10, 10, 0x334155, 0x1e293b]} />
            <axesHelper args={[6]} />

            {/* Axis labels */}
            <Html position={[6.8, 0, 0]} center zIndexRange={[40, 0]} pointerEvents="none">
                <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', pointerEvents: 'none' }}>
                    Weight 1 (β₁)
                </div>
            </Html>
            <Html position={[0, 7.0, 0]} center zIndexRange={[40, 0]} pointerEvents="none">
                <div style={{ color: '#22c55e', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', pointerEvents: 'none' }}>
                    Weight 2 (β₂)
                </div>
            </Html>
            <Html position={[0, 0, 6.8]} center zIndexRange={[40, 0]} pointerEvents="none">
                <div style={{ color: '#3b82f6', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', pointerEvents: 'none' }}>
                    Weight 3 (β₃)
                </div>
            </Html>

            {/* OLS point — best unconstrained fit */}
            <mesh position={OLS_POS}>
                <sphereGeometry args={[0.12, 32, 32]} />
                <meshPhongMaterial color="#60a5fa" emissive="#001133" />
            </mesh>
            <Html position={[OLS_POS.x, OLS_POS.y + 0.45, OLS_POS.z]} center zIndexRange={[40, 0]} pointerEvents="none">
                <div style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', background: 'rgba(15,23,42,0.75)', borderRadius: '4px', padding: '2px 6px', pointerEvents: 'none' }}>
                    Unconstrained minimum
                </div>
            </Html>

            {/* Constraint region (sphere for Ridge, octahedron for Lasso) */}
            <ConstraintShape mode={mode} budgetT={budgetT} />

            {/* Error contour ellipsoid centered at OLS */}
            {loss > 1e-12 && <mesh position={OLS_POS} scale={contourScale}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshPhongMaterial color="#3b82f6" wireframe transparent opacity={0.15} />
            </mesh>}

            {/* Constrained solution (red dot) */}
            <mesh position={solutionPoint}>
                <sphereGeometry args={[0.15, 32, 32]} />
                <meshPhongMaterial color="#ef4444" emissive="#330000" />
            </mesh>

            {/* Dashed lines: OLS → solution, origin → solution */}
            <DashedLine start={OLS_POS} end={solutionPoint} />
            <DashedLine start={ORIGIN} end={solutionPoint} />
        </>
    );
}

// --- Main export ---

export default function LagrangeConstraints() {
    const { topicId } = useParams<{ topicId: string }>();
    const [mode, setMode] = useState<'ridge' | 'lasso'>('ridge');
    const [budgetT, setBudgetT] = useState(1.5);
    const solution = useMemo(() => solveBudgetQuadratic(mode, budgetT), [mode, budgetT]);
    const loss = quadraticWeightLoss(solution);

    const latexEq = mode === 'ridge'
        ? `\\beta_1^2 + \\beta_2^2 + \\beta_3^2 \\leq ${(budgetT ** 2).toFixed(2)}`
        : `|\\beta_1| + |\\beta_2| + |\\beta_3| \\leq ${budgetT.toFixed(2)}`;

    const shapeColor = mode === 'ridge' ? '#34d399' : '#fbbf24';
    const shapeBg = mode === 'ridge' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)';
    const shapeBorder = mode === 'ridge' ? '#10b981' : '#f59e0b';

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                    Ridge & Lasso Constraints
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '11px' }}>
                    Minimize a stated quadratic error under a weight budget.
                </p>
            </div>

            {/* Mode toggle */}
            <div>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Penalty Type
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setMode('ridge')}
                        style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid #334155',
                            cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            background: mode === 'ridge' ? '#2563eb' : '#1e293b',
                            color: mode === 'ridge' ? 'white' : '#94a3b8',
                            transition: 'all 0.2s',
                        }}
                    >
                        Ridge (L2)
                    </button>
                    <button
                        onClick={() => setMode('lasso')}
                        style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid #334155',
                            cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            background: mode === 'lasso' ? '#d97706' : '#1e293b',
                            color: mode === 'lasso' ? 'white' : '#94a3b8',
                            transition: 'all 0.2s',
                        }}
                    >
                        Lasso (L1)
                    </button>
                </div>
            </div>

            {/* Budget slider */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Allowed Budget (t)
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        {budgetT.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range" aria-label="Allowed Budget"
                    min="0.1"
                    max="8"
                    step="0.01"
                    value={budgetT}
                    onChange={(e) => setBudgetT(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Explainer */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid #1e293b', padding: '12px', fontSize: '12px', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '10px', color: '#cbd5e1' }}>
                <div>
                    <strong style={{ color: '#93c5fd' }}>Blue Mesh:</strong>{' '}
                    A level set of the computed quadratic loss. Every point on this ellipsoid has the same loss; its center is the unconstrained minimum.
                </div>
                <div>
                    <strong style={{ color: shapeColor }}>Feasible Area:</strong>{' '}
                    Your Allowance or Budget. We want to reach the center of the blue bubble, but we are mathematically trapped inside this solid shape.
                </div>
                <div style={{ background: '#0f172a', borderRadius: '6px', padding: '8px 12px', textAlign: 'center', color: '#fcd34d' }}>
                    <Latex formula={latexEq} display />
                </div>
                <div>
                    <strong style={{ color: '#f87171' }}>Red Dot:</strong>{' '}
                    The computed constrained minimum. When the budget is active, the loss ellipsoid touches the allowed shape here. With enough budget, the dot reaches the unconstrained minimum.
                </div>
            </div>

            <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.7 }}>This example uses L(β) = ½[(β₁−3)² + 2(β₂−2.5)² + 4(β₃−2)²]. Optimality conditions determine the minimum. L1 can set coordinates to exactly zero; L2 generally shrinks them unequally.</p>
            <p aria-live="polite" style={{ fontSize: '12px', color: '#cbd5e1' }}>Computed weights: ({solution.map(value => value.toFixed(3)).join(', ')}). Loss: {loss.toFixed(3)}. Zero coordinates: {solution.filter(value => value === 0).length}.</p>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 12, height: 12, border: '1px solid #3b82f6', flexShrink: 0 }} />
                    <span><strong>Blue Mesh:</strong> Same-Error Boundary</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 12, height: 12, background: shapeBg, border: `1px solid ${shapeBorder}`, flexShrink: 0 }} />
                    <span><strong>Solid Shape:</strong> Allowed Budget</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: '50%', flexShrink: 0 }} />
                    <span><strong>Red Dot:</strong> Best Allowed Solution</span>
                </div>
            </div>

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic' }}>
                Drag to rotate; focus the view for keyboard camera controls
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <SceneCanvas frameloop="demand" dpr={[1, 1.5]} camera={CONSTRAINT_CAMERA} aria-label="Computed minimum of a diagonal quadratic under L2 or L1 weight budgets, with its true loss contour">
                <Scene mode={mode} budgetT={budgetT} />
            </SceneCanvas>
        </SceneContainer>
    );
}
