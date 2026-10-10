import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Layers, Minimize2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';

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
    const groupRef = useRef<THREE.Group>(null!);
    useFrame((state) => {
        groupRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    });

    // The "weird shape" - a torus knot
    const blobRef = useRef<THREE.Mesh>(null!);

    // Generate covering boxes
    const boxes = useMemo(() => {
        const count = [8, 27, 64, 125][resolution]; // More boxes = tighter cover
        const spread = [2.2, 1.8, 1.5, 1.3][resolution];
        const boxSize = [1.0, 0.7, 0.45, 0.32][resolution];
        const result: { pos: [number, number, number]; size: number }[] = [];

        // Deterministic jitter keeps the cover stable across renders.
        let seed = 12345;
        const jitter = () => {
            seed = (1664525 * seed + 1013904223) >>> 0;
            return seed / 4294967296 - 0.5;
        };
        // Place boxes around a torus-knot-like path
        for (let i = 0; i < count; i++) {
            const t = (i / count) * Math.PI * 4;
            const r = 1.2 + 0.4 * Math.cos(t * 1.5);
            const x = r * Math.cos(t) + jitter() * spread * 0.4;
            const y = 0.5 * Math.sin(t * 1.5) + jitter() * spread * 0.4;
            const z = r * Math.sin(t) + jitter() * spread * 0.4;
            result.push({ pos: [x, y, z], size: boxSize });
        }
        return result;
    }, [resolution]);

    const totalVolume = boxes.reduce((acc, b) => acc + (b.size * b.size * b.size), 0);

    return (
        <group ref={groupRef}>
            {/* The actual shape being measured */}
            <mesh ref={blobRef}>
                <torusKnotGeometry args={[1.2, 0.35, 64, 16]} />
                <meshPhongMaterial color="#a855f7" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>

            {/* Covering boxes */}
            {boxes.map((box, i) => (
                <mesh key={i} position={box.pos}>
                    <boxGeometry args={[box.size, box.size, box.size]} />
                    <meshPhongMaterial color="#4ade80" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
            ))}
            {boxes.map((box, i) => (
                <lineSegments key={`e${i}`} position={box.pos}>
                    <edgesGeometry args={[new THREE.BoxGeometry(box.size, box.size, box.size)]} />
                    <lineBasicMaterial color="#4ade80" transparent opacity={0.5} />
                </lineSegments>
            ))}

            {/* Volume annotation */}
            <Html position={[0, 2.5, 0]} center>
                <div style={{
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    textAlign: 'center',
                    pointerEvents: 'none',
                }}>
                    <div style={{ fontSize: '10px', color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Outer Measure (upper bound)
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#4ade80', fontFamily: 'monospace' }}>
                        &Sigma; box volumes = {totalVolume.toFixed(1)}
                    </div>
                </div>
            </Html>
        </group>
    );
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
                <boxGeometry args={[planeSize + 0.2, thickness, planeSize + 0.2]} />
                <meshPhongMaterial color="#22c55e" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <lineSegments position={[0, 0, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(planeSize + 0.2, thickness, planeSize + 0.2)]} />
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
        description: 'To measure an irregular shape, we cover it with small boxes and sum their volumes. As boxes shrink, the sum converges to the true measure. The tightest possible cover gives the outer measure.',
    },
    {
        id: 'null-sets',
        title: 'Null Sets',
        Icon: Layers,
        subtitle: 'When volume = 0',
        description: 'A 2D plane living in 3D space has zero 3D volume. No matter how you cover it with 3D boxes, you can make the total volume as small as you like by making the boxes thinner. In the limit: measure = 0.',
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
                        type="range" min="1" max="3" step="1" value={dimension}
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
                        type="range" min="0" max="3" step="1" value={resolution}
                        onChange={e => setResolution(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#4ade80' }}
                    />
                    <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', lineHeight: 1.4 }}>
                        More boxes = tighter cover = closer to the true measure
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
                        type="range" min="0" max="3" step="1" value={coverThickness}
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
            <SceneCanvas camera={{ position: [5, 4, 5], fov: 45 }} style={{ width: '100%', height: '100%' }} aria-label="3D visualization of Lebesgue measure properties including outer measure and covering">
                <SceneLighting />
                <gridHelper args={[10, 20, '#1e293b', '#0f172a']} position={[0, -0.01, 0]} />

                {activeStep === 0 && <MeasureBox dim={dimension} />}
                {activeStep === 1 && <OuterMeasureScene resolution={resolution} />}
                {activeStep === 2 && <NullSetScene coverThickness={coverThickness} />}

                <OrbitControls enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#0b0f19', 8, 20]} />
                <color attach="background" args={['#0b0f19']} />
            </SceneCanvas>
        </SceneContainer>
    );
}
