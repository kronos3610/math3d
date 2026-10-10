import { SceneContainer } from '../../components/layout/SceneContainer';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useRef, useMemo, useLayoutEffect } from 'react';
import { useSceneFrame as useFrame } from '../../hooks/useSceneFrame';
import { affineFlowAt, applyAffineFlow, flowDeterminant } from './legacyFlowMath';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Info } from 'lucide-react';
import Latex from '../../components/Latex';

// --- Types ---
type SceneType = 'manifold' | 'flows' | 'relu';

interface SceneProps {
    isActive: boolean;
}

// --- 1. Manifold Hypothesis Scene ---
const MANIFOLD_POINTS = (() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 10;
        const y = (Math.random() - 0.5) * 10;
        const z = Math.sin(x * 0.5) * 0.5 + Math.cos(y * 0.5) * 0.5 + (Math.random() - 0.5) * 0.2;
        points.push(new THREE.Vector3(x, y, z));
    }
    return points;
})();

function ManifoldScene({ isActive }: SceneProps) {
    if (!isActive) return null;

    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[12, 12, 32, 32]} />
                <meshStandardMaterial
                    color="#ef4444"
                    transparent
                    opacity={0.2}
                    side={THREE.DoubleSide}
                    wireframe
                />
            </mesh>

            <points rotation={[-Math.PI / 2, 0, 0]}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[new Float32Array(MANIFOLD_POINTS.flatMap(p => [p.x, p.y, p.z])), 3]}
                    />
                </bufferGeometry>
                <pointsMaterial size={0.08} color="#60a5fa" transparent opacity={0.8} />
            </points>
        </group>
    );
}

// --- 2. Normalizing Flows Scene ---
const FLOW_COUNT = 500;
const FLOW_INITIAL_POSITIONS = (() => {
    const pos: THREE.Vector3[] = [];
    for (let i = 0; i < FLOW_COUNT; i++) {
        const r = 2 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        pos.push(new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        ));
    }
    return pos;
})();

function FlowsScene({ isActive }: SceneProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);

    const dummy = useMemo(() => new THREE.Vector3(), []);
    const color = useMemo(() => new THREE.Color(), []);
    const matrix = useMemo(() => new THREE.Matrix4(), []);

    const elapsed = useRef(0);
    const updateFlow = (time: number) => {
        if (!isActive || !meshRef.current) return;
        const flow = affineFlowAt(time);
        const inverseVolume = 1 / flowDeterminant(flow);
        color.setHSL(0.6 - Math.min(1, inverseVolume / 3) * 0.4, 0.8, 0.5);
        for (let i = 0; i < FLOW_COUNT; i++) {
            const point = applyAffineFlow(FLOW_INITIAL_POSITIONS[i].toArray() as [number, number, number], flow);
            dummy.set(...point);
            matrix.setPosition(dummy);
            meshRef.current.setMatrixAt(i, matrix);
            meshRef.current.setColorAt(i, color);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.computeBoundingSphere();
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    };
    useLayoutEffect(() => { updateFlow(elapsed.current); });
    useFrame((_, delta) => { elapsed.current += delta; updateFlow(elapsed.current); });

    if (!isActive) return null;

    return (
        <group>
            <Grid infiniteGrid sectionColor="#3b82f6" cellColor="#0a0a0f" fadeDistance={20} />
            <instancedMesh ref={meshRef} args={[undefined, undefined, FLOW_COUNT]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial />
            </instancedMesh>
        </group>
    );
}

// --- 3. ReLU Scene ---
function ReLUScene({ isActive }: SceneProps) {
    const points = useMemo(() => {
        const p: THREE.Vector3[] = [];
        for (let x = -5; x <= 5; x += 0.1) {
            p.push(new THREE.Vector3(x, Math.max(0, x), 0));
        }
        return p;
    }, []);

    if (!isActive) return null;

    return (
        <group>
            <Grid infiniteGrid sectionColor="#3b82f6" cellColor="#0a0a0f" fadeDistance={20} />

            <Line
                points={points}
                color="#22c55e"
                lineWidth={5}
            />

            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.2, 16, 16]} />
                <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.5} />
            </mesh>
        </group>
    );
}

// --- Main Component ---
export default function MeasureTheoryML() {
    const [scene, setScene] = useState<SceneType>('manifold');

    const sceneData: Record<SceneType, { title: string; description: string; math: string; color: string }> = {
        manifold: {
            title: "The Manifold Hypothesis",
            description: "The manifold hypothesis says that complex observations often concentrate near a lower-dimensional structure. The blue points here are a noisy graph above a reference plane, not an exactly supported manifold distribution. An ideal distribution on a lower-dimensional manifold has zero ambient volume; this noisy cloud has thickness.",
            math: "\\lambda_3(M)=0 \\quad \\text{for a smooth 2D surface } M",
            color: '#f87171'
        },
        flows: {
            title: "Normalizing Flows",
            description: "This untrained, invertible affine flow deforms a uniform radius-two ball. Its triangular Jacobian has determinant s₁s₂s₃ > 0. All points have the same density inside each transformed solid: p = 3/(32π s₁s₂s₃). Color changes with inverse volume. Learned normalizing flows can use much richer invertible maps.",
            math: "p_x(x) = p_z(z) \\left| \\det \\frac{\\partial z}{\\partial x} \\right|",
            color: '#60a5fa'
        },
        relu: {
            title: "ReLU & Singularity",
            description: "ReLU is f(x) = max(0, x), with a corner at zero. That single point has Lebesgue measure zero, but software can reach it exactly. Training implementations choose a derivative convention there, commonly zero.",
            math: "\\lambda(\\{x : f'(x) \\text{ undefined}\\}) = 0",
            color: '#fbbf24'
        }
    };

    const current = sceneData[scene];

    return (
        <SceneContainer backUrl="/ml" defaultPanel="closed">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#050508', color: '#e2e8f0' }}>

            {/* Header / Controls */}
            <div style={{
                padding: '80px 24px 20px',
                borderBottom: '1px solid #0a0a0f',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ backgroundColor: '#a855f7', padding: '6px', borderRadius: '6px' }}>
                            <Info size={16} color="white" />
                        </span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Measure Theory in Machine Learning</h2>
                    </div>
                    <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
                        Why &quot;size&quot; and &quot;sets&quot; matter for generative models and deep learning.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {(['manifold', 'flows', 'relu'] as SceneType[]).map((key) => (
                        <button
                            key={key}
                            onClick={() => setScene(key)}
                            aria-pressed={scene === key}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: scene === key ? '#3b82f6' : '#334155',
                                backgroundColor: scene === key ? '#1d4ed8' : '#050508',
                                color: scene === key ? 'white' : '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                        >
                            {key === 'manifold' ? '1. Manifold' : key === 'flows' ? '2. Flows' : '3. ReLU'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content: 3D + Info */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

                <SceneCanvas frameloop={scene === 'flows' ? 'always' : 'demand'} camera={{ position: [5, 5, 5], fov: 50 }} aria-label="3D visualization of measure theory concepts in machine learning">
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} />
                    <OrbitControls makeDefault enableDamping dampingFactor={0.05} />

                    <ManifoldScene isActive={scene === 'manifold'} />
                    <FlowsScene isActive={scene === 'flows'} />
                    <ReLUScene isActive={scene === 'relu'} />
                </SceneCanvas>

                {/* Overlay Card */}
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '24px',
                    maxWidth: '400px',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid #334155',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                }}>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: current.color,
                        marginBottom: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {current.title}
                    </h3>

                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#cbd5e1', marginBottom: '16px' }}>
                        {current.description}
                    </p>

                    <div style={{
                        backgroundColor: '#050508',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #0a0a0f',
                        fontSize: '14px',
                        display: 'flex',
                        justifyContent: 'center'
                    }}>
                        <Latex formula={current.math} display />
                    </div>
                </div>

                {/* Legend / Instructions */}
                <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '24px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    fontSize: '11px',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                }}>
                    DRAG TO ROTATE • SCROLL TO ZOOM
                </div>

            </div>
        </div>
        </SceneContainer>
    );
}
