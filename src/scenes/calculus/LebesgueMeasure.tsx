import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { useSceneFrame as useFrame } from '../../hooks/useSceneFrame';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Layers, Minimize2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';
import { ellipsoidGridCover, ELLIPSOID_AXES, ELLIPSOID_VOLUME } from './ellipsoidCover';

// ─── Step 1: Building Blocks ───────────────────────────────────────────────────
// A transparent 3D box with labeled dimensions showing Volume = Δx·Δy·Δz

function MeasureBox({ dim }: { dim: number }) {
    const ref = useRef<THREE.Group>(null!);
    useFrame((state) => {
        ref.current.rotation.y = state.clock.elapsedTime * 0.15;
    });

    const sx = 2, sy = 1.5, sz = 1;
    const edgeColor = '#60a5fa';

    // Build edges from box corners
    const edges = useMemo(() => {
        const hx = sx / 2, hy = sy / 2, hz = sz / 2;
        const corners = [
            [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
            [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
        ] as [number, number, number][];
        const pairs = [
            [0, 1], [1, 2], [2, 3], [3, 0], // back face
            [4, 5], [5, 6], [6, 7], [7, 4], // front face
            [0, 4], [1, 5], [2, 6], [3, 7], // connecting
        ];
        return pairs.map(([a, b]) => [corners[a], corners[b]] as [[number, number, number], [number, number, number]]);
    }, []);

    return (
        <group ref={ref}>
            {/* Translucent faces */}
            <mesh>
                <boxGeometry args={[sx, sy, sz]} />
                <meshPhongMaterial color="#3b82f6" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {/* Wireframe edges */}
            {edges.map((pts, i) => (
                <Line key={i} points={pts} color={edgeColor} lineWidth={2} />
            ))}

            {/* Dimension labels */}
            <Html position={[0, -sy / 2 - 0.3, 0]} center>
                <div style={{ color: '#93c5fd', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                    Δx = {sx}
                </div>
            </Html>
            <Html position={[sx / 2 + 0.4, 0, 0]} center>
                <div style={{ color: '#93c5fd', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                    Δy = {sy}
                </div>
            </Html>
            <Html position={[0, sy / 2 + 0.3, sz / 2 + 0.15]} center>
                <div style={{ color: '#93c5fd', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                    Δz = {sz}
                </div>
            </Html>

            {/* Volume readout */}
            <Html position={[0, sy / 2 + 0.8, 0]} center>
                <div style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(96, 165, 250, 0.4)',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    textAlign: 'center',
                    pointerEvents: 'none',
                }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        {dim === 1 ? 'Length' : dim === 2 ? 'Area' : 'Volume'}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#60a5fa', fontFamily: 'monospace' }}>
                        {dim === 1 ? `${sx}` : dim === 2 ? `${sx} × ${sy} = ${sx * sy}` : `${sx} × ${sy} × ${sz} = ${sx * sy * sz}`}
                    </div>
                </div>
            </Html>

            {/* Highlight active dimensions */}
            {dim >= 1 && <Line points={[[-sx / 2, -sy / 2, -sz / 2], [sx / 2, -sy / 2, -sz / 2]]} color="#f87171" lineWidth={4} />}
            {dim >= 2 && <Line points={[[sx / 2, -sy / 2, -sz / 2], [sx / 2, sy / 2, -sz / 2]]} color="#34d399" lineWidth={4} />}
            {dim >= 3 && <Line points={[[sx / 2, -sy / 2, -sz / 2], [sx / 2, -sy / 2, sz / 2]]} color="#fbbf24" lineWidth={4} />}
        </group>
    );
}

// ─── Step 2: Outer Measure ─────────────────────────────────────────────────────
// An irregular blob shape covered by small boxes that approximate its volume

function OuterMeasureScene({ resolution }: { resolution: number }) {
    const boxes = useMemo(() => ellipsoidGridCover([4, 8, 16, 32][resolution]), [resolution]);
    const mesh = useRef<THREE.InstancedMesh>(null);
    useLayoutEffect(() => {
        if (!mesh.current) return;
        const matrix = new THREE.Matrix4();
        for (let index = 0; index < boxes.length; index++) {
            const cell = boxes[index];
            matrix.makeScale(cell.size, cell.size, cell.size);
            matrix.setPosition(...cell.position);
            mesh.current.setMatrixAt(index, matrix);
        }
        mesh.current.instanceMatrix.needsUpdate = true;
        mesh.current.computeBoundingSphere();
    }, [boxes]);
    const edges = useMemo(() => {
        const vertices: number[] = [];
        for (const box of boxes) for (let corner = 0; corner < 8; corner++) for (const bit of [1, 2, 4]) {
            if (corner >= (corner ^ bit)) continue;
            for (const endpoint of [corner, corner ^ bit]) for (let axis = 0; axis < 3; axis++) vertices.push(box.position[axis] + (endpoint & (1 << axis) ? 1 : -1) * box.size / 2);
        }
        const result = new THREE.BufferGeometry();
        result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        return result;
    }, [boxes]);
    useEffect(() => () => edges.dispose(), [edges]);
    const totalVolume = boxes.reduce((sum, cell) => sum + cell.size ** 3, 0);
    return <group>
        <mesh scale={[...ELLIPSOID_AXES]}><sphereGeometry args={[1, 48, 32]} /><meshPhongMaterial color="#a855f7" transparent opacity={0.55} side={THREE.DoubleSide} /></mesh>
        <instancedMesh ref={mesh} args={[undefined, undefined, boxes.length]}><boxGeometry args={[1, 1, 1]} /><meshPhongMaterial color="#4ade80" transparent opacity={0.05} depthWrite={false} /></instancedMesh>
        <lineSegments geometry={edges}><lineBasicMaterial color="#4ade80" transparent opacity={0.15} /></lineSegments>
        <Html position={[0, 2.5, 0]} center><div style={{ background: 'rgba(15,23,42,0.92)', border: '1px solid #4ade80', padding: '8px', borderRadius: '8px', color: '#cbd5e1', fontSize: '12px', pointerEvents: 'none', textAlign: 'center' }}>
            <b style={{ color: '#4ade80' }}>Guaranteed covering volume: {totalVolume.toFixed(3)}</b><br />
            {boxes.length} cells · Solid volume: {ELLIPSOID_VOLUME.toFixed(3)}
        </div></Html>
    </group>;
}

// ─── Step 3: Null Sets ─────────────────────────────────────────────────────────
// A 2D plane in 3D space has measure zero — visualized by shrinking covering boxes

function NullSetScene({ coverThickness }: { coverThickness: number }) {
    const groupRef = useRef<THREE.Group>(null!);
    useFrame((state) => {
        groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    });

    const planeSize = 4;
    const halfSize = planeSize / 2;

    // Cover boxes that get thinner
    const thickness = [0.8, 0.4, 0.15, 0.04][coverThickness];
    const coverVolume = planeSize * planeSize * thickness;
    const slabEdges = useMemo(() => {
        const box = new THREE.BoxGeometry(planeSize, thickness, planeSize);
        const result = new THREE.EdgesGeometry(box);
        box.dispose();
        return result;
    }, [thickness]);
    useEffect(() => () => slabEdges.dispose(), [slabEdges]);

    return (
        <group ref={groupRef}>
            {/* The 2D plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[planeSize, planeSize]} />
                <meshPhongMaterial color="#f59e0b" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>

            {/* Grid lines on the plane */}
            {Array.from({ length: 9 }).map((_, i) => {
                const offset = -halfSize + (i + 1) * (planeSize / 10);
                return (
                    <group key={i}>
                        <Line points={[[offset, 0.01, -halfSize], [offset, 0.01, halfSize]]} color="#fbbf24" lineWidth={0.5} transparent opacity={0.3} />
                        <Line points={[[-halfSize, 0.01, offset], [halfSize, 0.01, offset]]} color="#fbbf24" lineWidth={0.5} transparent opacity={0.3} />
                    </group>
                );
            })}

            {/* Covering slab (gets thinner) */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[planeSize, thickness, planeSize]} />
                <meshPhongMaterial color="#22c55e" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <lineSegments position={[0, 0, 0]} geometry={slabEdges}>
                <lineBasicMaterial color="#22c55e" transparent opacity={0.6} />
            </lineSegments>

            {/* Dimension arrows */}
            <Line points={[[halfSize + 0.5, -thickness / 2, halfSize + 0.5], [halfSize + 0.5, thickness / 2, halfSize + 0.5]]} color="#ef4444" lineWidth={3} />
            <Html position={[halfSize + 0.5, 0, halfSize + 1.0]} center>
                <div style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                    &epsilon; = {thickness.toFixed(2)}
                </div>
            </Html>

            {/* Volume readout */}
            <Html position={[0, 2.0, 0]} center>
                <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    textAlign: 'center',
                    pointerEvents: 'none',
                }}>
                    <div style={{ fontSize: '10px', color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Covering Volume
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: coverThickness === 3 ? '#ef4444' : '#fbbf24', fontFamily: 'monospace' }}>
                        {planeSize}&sup2; &times; {thickness.toFixed(2)} = {coverVolume.toFixed(2)} {coverThickness === 3 ? ' → 0' : ''}
                    </div>
                </div>
            </Html>

            {/* Label */}
            <Html position={[0, -1.2, 0]} center>
                <div style={{ color: '#fde68a', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                    2D plane in 3D space
                </div>
            </Html>
        </group>
    );
}

// ─── Shared Scene Lighting ─────────────────────────────────────────────────────

function SceneLighting() {
    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            <pointLight position={[-5, 3, 5]} intensity={0.4} color="#60a5fa" />
        </>
    );
}

// ─── Steps Config ──────────────────────────────────────────────────────────────

interface StepConfig {
    id: string;
    title: string;
    Icon: LucideIcon;
    subtitle: string;
    description: string;
}

const STEPS: StepConfig[] = [
    {
        id: 'building-blocks',
        title: 'Building Blocks',
        Icon: Box,
        subtitle: 'What does "size" mean?',
        description: 'Lebesgue measure generalizes length, area, and volume. In 1D it measures length, in 2D area, in 3D volume. The basic unit is an n-dimensional box — its measure is the product of all side lengths.',
    },
    {
        id: 'outer-measure',
        title: 'Outer Measure',
        Icon: Minimize2,
        subtitle: 'Covering strange shapes',
        description: 'The green grid boxes cover the entire purple ellipsoid. Their summed volume is a computed upper bound and approaches the known solid volume on finer nested grids. Outer measure is the infimum over all suitable countable covers, not the value of one finite cover.',
    },
    {
        id: 'null-sets',
        title: 'Null Sets',
        Icon: Layers,
        subtitle: 'When volume = 0',
        description: 'This bounded 2D square has positive area but zero 3D volume. Its covering slab has volume 16ε, which can be made arbitrarily small by reducing its thickness. An entire unbounded plane also has zero 3D volume, using a countable family of covers. In the limit: measure = 0.',
    },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function LebesgueMeasure() {
    const { topicId } = useParams();
    const [activeStep, setActiveStep] = useState(0);

    // Step-specific params
    const [dimension, setDimension] = useState(3);
    const [resolution, setResolution] = useState(0);
    const [coverThickness, setCoverThickness] = useState(0);

    const step = STEPS[activeStep];

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white' }}>Lebesgue Measure</h1>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>The universal ruler for ℝⁿ</p>
            </div>

            {/* Step Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {STEPS.map((s, idx) => {
                    const StepIcon = s.Icon;
                    const isActive = activeStep === idx;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setActiveStep(idx)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                border: '1px solid',
                                borderColor: isActive ? '#3b82f6' : '#1e293b',
                                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                color: isActive ? '#fff' : '#94a3b8',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s',
                            }}
                        >
                            <StepIcon size={16} style={{ flexShrink: 0, color: isActive ? '#60a5fa' : '#64748b' }} />
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.title}</div>
                                <div style={{ fontSize: '10px', color: isActive ? '#93c5fd' : '#64748b' }}>{s.subtitle}</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Description */}
            <GlassPane style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderLeft: '2px solid #3b82f6' }}>
                <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    {step.description}
                </p>
            </GlassPane>

            {/* Step-specific controls */}
            {activeStep === 0 && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                        <span>Dimension</span>
                        <span style={{ color: '#60a5fa' }}>{dimension}D → {dimension === 1 ? 'Length' : dimension === 2 ? 'Area' : 'Volume'}</span>
                    </div>
                    <input
                        aria-label="Dimension" type="range" min="1" max="3" step="1" value={dimension}
                        onChange={e => setDimension(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#3b82f6' }}
                    />
                </div>
            )}

            {activeStep === 1 && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                        <span>Box Resolution</span>
                        <span style={{ color: '#4ade80' }}>{['Coarse', 'Medium', 'Fine', 'Very Fine'][resolution]}</span>
                    </div>
                    <input
                        aria-label="Box Resolution" type="range" min="0" max="3" step="1" value={resolution}
                        onChange={e => setResolution(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#4ade80' }}
                    />
                    <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', lineHeight: 1.4 }}>
                        Every displayed box intersects the solid. Refining this nested grid reduces excess covering volume; the readout compares it with the exact ellipsoid volume.
                    </p>
                </div>
            )}

            {activeStep === 2 && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                        <span>Cover Thickness (&epsilon;)</span>
                        <span style={{ color: '#fbbf24' }}>{[0.8, 0.4, 0.15, 0.04][coverThickness].toFixed(2)}</span>
                    </div>
                    <input
                        aria-label="Cover Thickness" type="range" min="0" max="3" step="1" value={coverThickness}
                        onChange={e => setCoverThickness(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#fbbf24' }}
                    />
                    <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', lineHeight: 1.4 }}>
                        Drag right to shrink the covering slab. Volume → 0 as &epsilon; → 0.
                    </p>
                </div>
            )}

            {/* Key Properties */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Properties</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', marginBottom: '2px' }}>Translation</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Move it → same size</div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', padding: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', marginBottom: '2px' }}>Additivity</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Parts sum to whole</div>
                    </div>
                </div>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas frameloop="always" camera={{ position: [5, 4, 5], fov: 45 }} style={{ width: '100%', height: '100%' }} aria-label="3D visualization of Lebesgue measure properties including outer measure and covering">
                <SceneLighting />
                <gridHelper args={[10, 20, '#1e293b', '#0f172a']} position={[0, -0.01, 0]} />

                {activeStep === 0 && <MeasureBox dim={dimension} />}
                {activeStep === 1 && <OuterMeasureScene resolution={resolution} />}
                {activeStep === 2 && <NullSetScene coverThickness={coverThickness} />}

                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#0b0f19', 8, 20]} />
                <color attach="background" args={['#0b0f19']} />
            </SceneCanvas>
        </SceneContainer>
    );
}
