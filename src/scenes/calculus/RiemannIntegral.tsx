import { SceneContainer } from '../../components/layout/SceneContainer';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useRef, useMemo, useLayoutEffect } from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Activity, Info } from 'lucide-react';
import Latex from '../../components/Latex';
import { calculateRiemannBoxes } from './riemannUtils';

interface RiemannSceneProps {
    nPartitions: number;
}

function RiemannScene({ nPartitions }: RiemannSceneProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);

    const curvePoints = useMemo(() => {
        const points: THREE.Vector3[] = [];
        for (let x = -4; x <= 4; x += 0.1) {
            points.push(new THREE.Vector3(x, Math.sin(x) + 2, 0));
        }
        return points;
    }, []);

    const boxes = useMemo(() => {
        return calculateRiemannBoxes(
            -4,
            4,
            nPartitions,
            (x: number) => Math.sin(x) + 2
        );
    }, [nPartitions]);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        const tempObject = new THREE.Object3D();
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            tempObject.position.set(box.position[0], box.position[1], box.position[2]);
            tempObject.scale.set(box.scale[0], box.scale[1], box.scale[2]);
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.computeBoundingSphere();
    }, [boxes]);

    return (
        <>
            <gridHelper args={[10, 10, 0x555570, 0x1e293b]} />

            {/* Function curve */}
            <line>
                <bufferGeometry attach="geometry">
                    <bufferAttribute
                        attach="attributes-position"
                        args={[new Float32Array(curvePoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={0x00cec9} linewidth={3} />
            </line>

            {/* Riemann boxes */}
            <instancedMesh ref={meshRef} args={[undefined, undefined, boxes.length]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshPhongMaterial color={0x6c5ce7} transparent opacity={0.5} />
            </instancedMesh>

            <directionalLight position={[5, 5, 5]} intensity={1} />
            <ambientLight intensity={0.4} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
            <fog attach="fog" args={['#050508', 5, 15]} />
        </>
    );
}

export default function RiemannIntegral() {
    const [riemannN, setRiemannN] = useState(12);

    const controls = (
            <div
                style={{
                    background: 'rgba(5, 5, 8, 0.8)',
                    backdropFilter: 'blur(12px)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                    color: '#f8fafc',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    overflowY: 'auto',
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                }}
            >
                <div>
                    <h2
                        style={{
                            fontSize: '24px',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #00cec9, #6c5ce7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <Activity size={24} style={{ color: '#00cec9' }} />
                        <span>Riemann Integral</span>
                    </h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                        Visualizing domain partitioning and the limits of integration
                    </p>
                </div>

                {/* Main explanation */}
                <div
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '20px',
                    }}
                >
                    <h3
                        style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#00cec9',
                            marginBottom: '12px',
                        }}
                    >
                        Domain Partitioning
                    </h3>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '16px' }}>
                        The Riemann integral chops the <strong>domain</strong> (x-axis) into pieces and sums
                        up rectangles.
                    </p>
                    <div
                        style={{
                            padding: '16px',
                            background: 'rgba(0, 206, 201, 0.1)',
                            borderRadius: '8px',
                            borderLeft: '4px solid #00cec9',
                            fontFamily: 'monospace',
                            fontSize: '15px',
                            textAlign: 'center',
                            overflowX: 'auto',
                        }}
                    >
                        <Latex
                            display
                            formula="\int_a^b f(x) \, dx = \lim_{n \to \infty} \sum_{i=1}^n f(x_i^*) \Delta x"
                        />
                    </div>
                </div>

                {/* Partition control */}
                <div
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '16px',
                    }}
                >
                    <label
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#94a3b8',
                            marginBottom: '12px',
                        }}
                    >
                        <span>
                            Number of Partitions (<Latex formula="n" />):
                        </span>
                        <span style={{ color: '#00cec9', fontWeight: 700 }}>{riemannN}</span>
                    </label>
                    <input
                        aria-label="Number of partitions"
                        type="range"
                        min="4"
                        max="80"
                        value={riemannN}
                        onChange={(e) => setRiemannN(parseInt(e.target.value))}
                        style={{
                            width: '100%',
                            height: '8px',
                            background: '#334155',
                            borderRadius: '4px',
                            outline: 'none',
                            cursor: 'pointer',
                            accentColor: '#00cec9',
                        }}
                    />
                </div>

                {/* Why it fails */}
                <div
                    style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        padding: '16px',
                    }}
                >
                    <h4
                        style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            color: '#f87171',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <Info size={16} />
                        <span>When does Riemann integration fail?</span>
                    </h4>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, fontStyle: 'italic' }}>
                        The smooth curve shown here is Riemann integrable. A function that is 1 at rational
                        numbers and 0 at irrationals is not: its upper and lower sums stay apart. Lebesgue
                        integration can handle that example.
                    </p>
                </div>

                {/* Legend */}
                <div
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '16px',
                    }}
                >
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' }}>
                        Visualization
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '24px',
                                    height: '3px',
                                    background: '#00cec9',
                                    borderRadius: '2px',
                                }}
                            />
                            <span style={{ color: '#cbd5e1' }}>f(x) — The function curve</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '24px',
                                    height: '16px',
                                    background: 'rgba(108, 92, 231, 0.5)',
                                    borderRadius: '3px',
                                }}
                            />
                            <span style={{ color: '#cbd5e1' }}>Riemann rectangles</span>
                        </div>
                    </div>
                </div>
            </div>
    );

    return (
        <SceneContainer backUrl="/calculus" controls={controls}>
            <SceneCanvas frameloop="demand" camera={{ position: [0, 4, 8], fov: 75 }} aria-label="3D Riemann sum: rectangles approximate the area under sin(x) + 2">
                <color attach="background" args={['#050508']} />
                <RiemannScene nPartitions={riemannN} />
            </SceneCanvas>
        </SceneContainer>
    );
}
