import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// The ideal unconstrained solution (OLS optimum)
const OLS_POS = new THREE.Vector3(3.0, 2.5, 2.0);
const ORIGIN = new THREE.Vector3(0, 0, 0);

function computeSolutionPoint(mode: 'ridge' | 'lasso', budgetT: number): THREE.Vector3 {
    const dir = OLS_POS.clone().normalize();

    if (mode === 'ridge') {
        return dir.multiplyScalar(budgetT);
    }

    // L1: project onto the octahedron surface
    const absSum = Math.abs(dir.x) + Math.abs(dir.y) + Math.abs(dir.z);
    const intersect = dir.multiplyScalar(budgetT / absSum);

    // Snap to axis if one weight dominates (shows lasso sparsity)
    const wx = Math.abs(intersect.x);
    const wy = Math.abs(intersect.y);
    const wz = Math.abs(intersect.z);
    const maxW = Math.max(wx, wy, wz);

    if (maxW / budgetT > 0.75) {
        if (wx === maxW) return new THREE.Vector3(Math.sign(intersect.x) * budgetT, 0, 0);
        if (wy === maxW) return new THREE.Vector3(0, Math.sign(intersect.y) * budgetT, 0);
        return new THREE.Vector3(0, 0, Math.sign(intersect.z) * budgetT);
    }
    return intersect;
}

// --- Sub-components ---

function AutoRotateCamera() {
    useFrame((state) => {
        const t = state.clock.elapsedTime * 0.15;
        state.camera.position.x = 12 * Math.cos(t);
        state.camera.position.z = 12 * Math.sin(t);
        state.camera.position.y = 8;
        state.camera.lookAt(0, 0, 0);
    });
    return null;
}

function ConstraintShape({ mode, budgetT }: { mode: 'ridge' | 'lasso'; budgetT: number }) {
    const color = mode === 'ridge' ? '#10b981' : '#f59e0b';
    const edgeColor = mode === 'ridge' ? '#059669' : '#d97706';

    const { geometry, edges } = useMemo(() => {
        const geo = mode === 'ridge'
            ? new THREE.SphereGeometry(budgetT, 40, 40)
            : new THREE.OctahedronGeometry(budgetT, 0);
        return { geometry: geo, edges: new THREE.EdgesGeometry(geo) };
    }, [mode, budgetT]);

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
    return <primitive object={lineObj} />;
}

function Scene({ mode, budgetT }: { mode: 'ridge' | 'lasso'; budgetT: number }) {
    const solutionPoint = useMemo(() => computeSolutionPoint(mode, budgetT), [mode, budgetT]);
    const dist = OLS_POS.distanceTo(solutionPoint);

    return (
        <>
            <color attach="background" args={['#0b0f19']} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />

            <AutoRotateCamera />

            <gridHelper args={[10, 10, 0x334155, 0x1e293b]} />
            <axesHelper args={[6]} />

            {/* Axis labels */}
            <Html position={[6.8, 0, 0]} center>
                <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', pointerEvents: 'none' }}>
                    Weight 1 (β₁)
                </div>
            </Html>
            <Html position={[0, 7.0, 0]} center>
                <div style={{ color: '#22c55e', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', pointerEvents: 'none' }}>
                    Weight 2 (β₂)
                </div>
            </Html>
            <Html position={[0, 0, 6.8]} center>
                <div style={{ color: '#3b82f6', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', pointerEvents: 'none' }}>
                    Weight 3 (β₃)
                </div>
            </Html>

            {/* OLS point — best unconstrained fit */}
            <mesh position={OLS_POS}>
                <sphereGeometry args={[0.12, 32, 32]} />
                <meshPhongMaterial color="#60a5fa" emissive="#001133" />
            </mesh>
            <Html position={[OLS_POS.x, OLS_POS.y + 0.45, OLS_POS.z]} center>
                <div style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', background: 'rgba(15,23,42,0.75)', borderRadius: '4px', padding: '2px 6px', pointerEvents: 'none' }}>
                    Best Unconstrained Fit
                </div>
            </Html>

            {/* Constraint region (sphere for Ridge, octahedron for Lasso) */}
            <ConstraintShape mode={mode} budgetT={budgetT} />

            {/* Error contour ellipsoid centered at OLS */}
            <mesh position={OLS_POS} scale={[dist * 1.2, dist * 1.0, dist * 0.8]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshPhongMaterial color="#3b82f6" wireframe transparent opacity={0.15} />
            </mesh>

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

    const latexEq = mode === 'ridge'
        ? `\\beta_1^2 + \\beta_2^2 + \\beta_3^2 \\leq ${budgetT.toFixed(2)}`
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
                    The budget metaphor for regularization.
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
                    type="range"
                    min="0.1"
                    max="4"
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
                    A map of model Error. Every point on this bubble has the exact same error. The center is the absolute lowest error possible.
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
                    The best compromise — the exact point where the Error bubble first touches the Budget shape. We can't afford to go any closer!
                </div>
            </div>

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
                Auto-rotating camera
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <SceneCanvas dpr={[1, 1.5]} camera={{ position: [10, 8, 12], fov: 50 }} aria-label="3D visualization of Ridge and Lasso regularization constraints on model weights">
                <Scene mode={mode} budgetT={budgetT} />
            </SceneCanvas>
        </SceneContainer>
    );
}
