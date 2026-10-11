import { VIZ } from '../../data/palette';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSceneFrame as useFrame } from '../../hooks/useSceneFrame';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// ---------------------------------------------------------------------------
// Scene constants
// ---------------------------------------------------------------------------

const PLANE_SIZE = 20;
const RESOLUTION = 64;
const TARGET_X = 2;
const TARGET_Z = -2;
const CEILING_HEIGHT = 10;
const BOX_W = 4;
const BOX_D = 4;
const ROOM_X = 15;

// ---------------------------------------------------------------------------
// True Posterior — complex mountain (static)
// ---------------------------------------------------------------------------

function TruePosterior() {
    const geom = useMemo(() => {
        const g = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, RESOLUTION, RESOLUTION);
        g.rotateX(-Math.PI / 2);
        const pos = g.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            let y = 6 * Math.exp(-((x - TARGET_X) ** 2 + (z - TARGET_Z) ** 2) / 6);
            y += 3 * Math.exp(-((x + 4) ** 2 + (z - 4) ** 2) / 8);
            y += 0.8 * Math.sin(x * 1.5) * Math.cos(z * 1.5);
            y = Math.max(0, y);
            pos.setY(i, y);
        }
        g.computeVertexNormals();
        return g;
    }, []);

    useEffect(() => () => geom.dispose(), [geom]);
    return (
        <>
            <mesh geometry={geom} castShadow receiveShadow>
                <meshStandardMaterial
                    color={VIZ.truth}
                    transparent
                    opacity={0.7}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <mesh geometry={geom}>
                <meshBasicMaterial
                    color={VIZ.truth}
                    wireframe
                    transparent
                    opacity={0.3}
                />
            </mesh>
        </>
    );
}

// ---------------------------------------------------------------------------
// Approximate Q(Z) — moldable gaussian hill driven by progress
// ---------------------------------------------------------------------------

function ApproximateHill({ progress }: { progress: number }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const geom = useMemo(() => {
        const g = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, RESOLUTION, RESOLUTION);
        g.rotateX(-Math.PI / 2);
        return g;
    }, []);

    useEffect(() => () => geom.dispose(), [geom]);
    useEffect(() => {
        const g = meshRef.current?.geometry as THREE.PlaneGeometry | undefined;
        if (!g) return;
        const pos = g.attributes.position as THREE.BufferAttribute;

        const startX = -6, startZ = 6;
        const muX = startX + progress * (TARGET_X - startX);
        const muZ = startZ + progress * (TARGET_Z - startZ);
        const sigma = 4 - progress * (4 - 1.5);
        const amp = 2 + progress * (5.8 - 2);

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = amp * Math.exp(-((x - muX) ** 2 + (z - muZ) ** 2) / (2 * sigma ** 2));
            pos.setY(i, y);
        }
        pos.needsUpdate = true;
        g.computeVertexNormals();
    }, [progress]);

    return (
        <mesh ref={meshRef} geometry={geom} position={[0, 0.1, 0]} castShadow>
            <meshStandardMaterial
                color={VIZ.focus}
                emissive={VIZ.focus}
                emissiveIntensity={0.2}
                transparent
                opacity={0.9}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// ---------------------------------------------------------------------------
// Equation room — ceiling, ELBO box, KL gap box
// ---------------------------------------------------------------------------

function EquationRoom({ progress }: { progress: number }) {
    const frameGeometry = useMemo(() => new THREE.BoxGeometry(BOX_W, CEILING_HEIGHT, BOX_D), []);
    useEffect(() => () => frameGeometry.dispose(), [frameGeometry]);
    const minElbo = 2;
    const maxElbo = CEILING_HEIGHT - 2;
    const elboH = minElbo + progress * (maxElbo - minElbo);
    const klH = CEILING_HEIGHT - elboH;

    return (
        <group position={[ROOM_X, 0, 0]}>
            {/* Ceiling — log P(X) */}
            <mesh position={[0, CEILING_HEIGHT, 0]}>
                <boxGeometry args={[BOX_W + 1, 0.2, BOX_D + 1]} />
                <meshStandardMaterial
                    color={VIZ.white}
                    transparent
                    opacity={0.3}
                    roughness={0.1}
                    metalness={0.8}
                />
            </mesh>

            {/* Outline frame */}
            <lineSegments position={[0, CEILING_HEIGHT / 2, 0]}>
                <edgesGeometry args={[frameGeometry]} />
                <lineBasicMaterial color={VIZ.white} transparent opacity={0.25} />
            </lineSegments>

            {/* ELBO box (green) */}
            <mesh position={[0, elboH / 2, 0]} scale={[1, elboH, 1]} castShadow>
                <boxGeometry args={[BOX_W, 1, BOX_D]} />
                <meshStandardMaterial color={VIZ.truth} />
            </mesh>

            {/* KL gap box (red) */}
            <mesh position={[0, elboH + klH / 2, 0]} scale={[1, klH, 1]}>
                <boxGeometry args={[BOX_W, 1, BOX_D]} />
                <meshStandardMaterial
                    color={VIZ.error}
                    emissive={VIZ.error}
                    emissiveIntensity={0.3}
                    transparent
                    opacity={0.85}
                />
            </mesh>

            {/* Labels */}
            <Html position={[0, CEILING_HEIGHT + 0.9, 0]} center>
                <span style={{
                    color: 'white', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(11,15,25,0.85)', padding: '3px 10px',
                    borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'nowrap',
                    border: '1px solid rgba(255,255,255,0.2)',
                }}>
                    log P(X) — Evidence
                </span>
            </Html>
            <Html position={[BOX_W / 2 + 0.8, elboH / 2, 0]} center>
                <span style={{
                    color: VIZ.truth, fontSize: '11px', fontWeight: 700,
                    background: 'rgba(11,15,25,0.85)', padding: '2px 8px',
                    borderRadius: '5px', pointerEvents: 'none', whiteSpace: 'nowrap',
                    border: '1px solid rgba(16,185,129,0.3)',
                }}>
                    ELBO
                </span>
            </Html>
            {klH > 0.4 && (
                <Html position={[BOX_W / 2 + 0.8, elboH + klH / 2, 0]} center>
                    <span style={{
                        color: VIZ.error, fontSize: '11px', fontWeight: 700,
                        background: 'rgba(11,15,25,0.85)', padding: '2px 8px',
                        borderRadius: '5px', pointerEvents: 'none', whiteSpace: 'nowrap',
                        border: '1px solid rgba(239,68,68,0.3)',
                    }}>
                        KL(q ‖ p)
                    </span>
                </Html>
            )}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Auto-play driver (lives inside <SceneCanvas> so it can use useFrame)
// ---------------------------------------------------------------------------

function AutoPlay({
    playing,
    onProgress,
}: {
    playing: boolean;
    onProgress: (dProgress: number) => void;
}) {
    const elapsed = useRef(0);
    useFrame((_, delta) => {
        if (!playing) { elapsed.current = 0; return; }
        elapsed.current += Math.min(delta, 0.1);
        if (elapsed.current < 1 / 30) return;
        onProgress(elapsed.current * 0.2);
        elapsed.current = 0;
    });
    return null;
}

// ---------------------------------------------------------------------------
// Full scene
// ---------------------------------------------------------------------------

function Scene3D({ progress, playing, onTick }: {
    progress: number;
    playing: boolean;
    onTick: (dProgress: number) => void;
}) {
    return (
        <>
            <color attach="background" args={['#111827']} />
            <fogExp2 attach="fog" args={['#111827', 0.015]} />
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[10, 30, 20]}
                intensity={0.9}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-left={-25}
                shadow-camera-right={25}
                shadow-camera-top={25}
                shadow-camera-bottom={-25}
                shadow-camera-near={0.5}
                shadow-camera-far={100}
            />

            <OrbitControls makeDefault
                target={[5, 5, 0]}
                enableDamping
                dampingFactor={0.05}
                maxPolarAngle={Math.PI / 2.05}
                minDistance={12}
                maxDistance={60}
            />

            <gridHelper args={[50, 50, 0x4b5563, 0x374151]} position={[0, -0.1, 0]} />

            {/* Landscape labels */}
            <Html position={[TARGET_X, 7, TARGET_Z]} center>
                <span style={{
                    color: VIZ.data, fontSize: '12px', fontWeight: 700,
                    background: 'rgba(11,15,25,0.85)', padding: '3px 10px',
                    borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'nowrap',
                    border: '1px solid rgba(96,165,250,0.3)',
                }}>
                    P(Z|X) — True Posterior
                </span>
            </Html>

            <TruePosterior />
            <ApproximateHill progress={progress} />
            <EquationRoom progress={progress} />

            <AutoPlay playing={playing} onProgress={onTick} />
        </>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VariationalInference() {
    const { topicId } = useParams();
    const [progress, setProgress] = useState(0);
    const [playing, setPlaying] = useState(false);

    // Frame tick from inside <SceneCanvas>
    const handleTick = (dProgress: number) => {
        setProgress(prev => Math.min(1, prev + dProgress));
    };
    useEffect(() => {
        if (progress >= 1) {
            // Playback stops at the end of the illustration.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPlaying(false);
        }
    }, [progress]);

    const togglePlay = () => {
        if (progress >= 1) setProgress(0);
        setPlaying(p => !p);
    };

    const minElbo = 2;
    const maxElbo = CEILING_HEIGHT - 2;
    const elboVal = minElbo + progress * (maxElbo - minElbo);
    const klVal = CEILING_HEIGHT - elboVal;

    const statusText = progress < 0.3
        ? 'The initial approximation is far from the main peak. The boxes illustrate how ELBO and KL complement each other.'
        : progress < 0.8
            ? 'In variational inference, increasing ELBO decreases KL for fixed evidence. This animation illustrates that relationship.'
            : 'The illustration ends with a remaining gap. A single Gaussian cannot exactly match this multi-peaked shape; covering one peak does not imply KL is zero.';

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Title */}
            <div>
                <div style={{ fontSize: '10px', letterSpacing: '3px', color: VIZ.truth, marginBottom: '4px', textTransform: 'uppercase' }}>
                    Bayesian Inference
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>
                    Variational Inference
                </h2>
                <p style={{ fontSize: '11px', color: VIZ.axis }}>
                    Conceptual illustration of the ELBO–KL relationship
                </p>
            </div>

            <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
                Schematic only: the surfaces are unnormalized shapes, and the displayed values are illustrative units, not computed ELBO or KL. Playback does not run an optimizer.
            </p>

            {/* Equation decomposition */}
            <div style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '12px',
                textAlign: 'center',
            }}>
                <Latex formula="\log P(X) = \mathcal{L}(q) + \mathrm{KL}(q \,\|\, p)" display />
                <div style={{ color: '#64748b', fontSize: '10px', marginTop: '6px' }}>
                    Ceiling = ELBO + KL gap
                </div>
            </div>

            {/* Live values */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                padding: '12px',
            }}>
                <div style={{ color: VIZ.axis, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    Illustrative Values
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                        <div style={{ color: VIZ.muted, fontSize: '10px', marginBottom: '2px' }}>ELBO ℒ(q)</div>
                        <div style={{ color: VIZ.truth, fontFamily: 'monospace', fontWeight: 700, fontSize: '15px' }}>
                            {elboVal.toFixed(2)}
                        </div>
                    </div>
                    <div>
                        <div style={{ color: VIZ.muted, fontSize: '10px', marginBottom: '2px' }}>KL(q ‖ p)</div>
                        <div style={{ color: VIZ.error, fontFamily: 'monospace', fontWeight: 700, fontSize: '15px' }}>
                            {klVal.toFixed(2)}
                        </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: VIZ.muted, fontSize: '10px', marginBottom: '2px' }}>log P(X) (fixed)</div>
                        <div style={{ color: 'white', fontFamily: 'monospace', fontWeight: 700, fontSize: '15px' }}>
                            {CEILING_HEIGHT.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress / Play */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: VIZ.axis, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Illustration progress
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        {(progress * 100).toFixed(0)}%
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={togglePlay}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '34px', height: '34px', borderRadius: '50%',
                            background: '#6366f1', border: 'none', color: 'white',
                            cursor: 'pointer', flexShrink: 0,
                        }}
                        aria-label={playing ? 'Pause' : 'Play'}
                    >
                        {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                    </button>
                    <input
                        aria-label="Illustration progress" type="range" min="0" max="1" step="0.01" value={progress}
                        onChange={e => { setPlaying(false); setProgress(parseFloat(e.target.value)); }}
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: VIZ.muted, marginTop: '4px' }}>
                    <span>Start</span>
                    <span>End of illustration →</span>
                </div>
            </div>

            {/* Status */}
            <div style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '10px', padding: '12px',
                fontSize: '11px', color: VIZ.variation, lineHeight: 1.7,
            }}>
                {statusText}
            </div>

            {/* Legend */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid #1e293b',
                borderRadius: '10px', padding: '12px',
                fontSize: '11px', color: '#cbd5e1', lineHeight: 1.75,
            }}>
                <b style={{ color: 'white', display: 'block', marginBottom: '6px' }}>What you're seeing:</b>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Row color={VIZ.truth} label="True posterior P(Z|X) — fixed mountain" />
                    <Row color={VIZ.focus} label="Approximate Q(Z) — moldable hill" />
                    <Row color={VIZ.white} label="log P(X) — fixed ceiling (evidence)" outline />
                    <Row color={VIZ.truth} label="ELBO — box we maximize" />
                    <Row color={VIZ.error} label="KL — gap we shrink" />
                </div>
            </div>

            <p style={{ fontSize: '11px', color: VIZ.muted, textAlign: 'center', fontStyle: 'italic' }}>
                Drag to orbit · slider or play to explore
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'probability'}`} controls={controls} legend={[{ label: 'Target', meaning: 'illustrative unnormalized posterior shape', color: VIZ.truth, shape: 'line' }, { label: 'Approximation', meaning: 'illustrative Gaussian family', color: VIZ.focus, shape: 'line' }, { label: 'ELBO', meaning: 'illustrative lower-bound block', color: VIZ.truth, shape: 'square' }, { label: 'Gap', meaning: 'illustrative KL block', color: VIZ.error, shape: 'square' }]}>
            <SceneCanvas frameloop="always"
                aria-label="Conceptual illustration of approximate inference and the ELBO–KL identity; values are illustrative"
                shadows
                dpr={[1, 1.5]}
                camera={{ position: [-15, 20, 25], fov: 45 }}
            >
                <Scene3D
                    progress={progress}
                    playing={playing}
                    onTick={handleTick}
                />
            </SceneCanvas>
        </SceneContainer>
    );
}

function Row({ color, label, outline = false }: { color: string; label: string; outline?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
                width: '14px', height: '14px', borderRadius: '3px',
                background: outline ? 'transparent' : color, opacity: 0.85,
                border: outline ? `1px solid ${color}` : 'none', flexShrink: 0,
            }} />
            <span>{label}</span>
        </div>
    );
}
