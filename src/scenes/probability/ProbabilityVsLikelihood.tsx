import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo, useRef, useEffect } from 'react';

import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// --- Constants ---
const A = 1.5;
const SEGMENTS = 60;
const RANGE = 6;
const FIXED_X = 1;      // fixed parameter for Probability mode
const FIXED_B = 4.5;    // fixed data for Likelihood mode
const MLE_X = FIXED_B / A;  // 3

const getDensity = (b: number, x: number) =>
    (Math.exp(-0.5 * Math.pow(b - A * x, 2)) / Math.sqrt(2 * Math.PI)) * 5;

// --- Sub-Components ---

function GaussianSurface({ mode }: { mode: 'probability' | 'likelihood' }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const color = mode === 'probability' ? '#3b82f6' : '#4f46e5';

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(RANGE * 2, RANGE * 2, SEGMENTS, SEGMENTS);
        geo.rotateX(-Math.PI / 2);
        const positions = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            const b = positions[i];
            const x = positions[i + 2];
            positions[i + 1] = getDensity(b, x);
        }
        geo.computeVertexNormals();
        return geo;
    }, []);

    useEffect(() => () => geometry.dispose(), [geometry]);
    useEffect(() => {
        if (meshRef.current) {
            (meshRef.current.material as THREE.MeshPhongMaterial).color.setStyle(color);
        }
    }, [color]);

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshPhongMaterial
                color={color}
                side={THREE.DoubleSide}
                transparent
                opacity={0.65}
                shininess={40}
            />
        </mesh>
    );
}

function CuttingPlane({ visible, axis, pos, color }: {
    visible: boolean;
    axis: 'x' | 'z';
    pos: number;
    color: string;
}) {
    if (!visible) return null;
    const position: [number, number, number] = axis === 'z'
        ? [0, 2.5, pos]
        : [pos, 2.5, 0];
    const rotation: [number, number, number] = axis === 'x'
        ? [0, Math.PI / 2, 0]
        : [0, 0, 0];

    return (
        <mesh position={position} rotation={rotation}>
            <planeGeometry args={[RANGE * 2, 5]} />
            <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.2} />
        </mesh>
    );
}

function ThreeLine({ visible, points, color }: {
    visible: boolean;
    points: THREE.Vector3[];
    color: string;
}) {
    const lineObject = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geo, mat);
    }, [points, color]);

    useEffect(() => () => { lineObject.geometry.dispose(); (lineObject.material as THREE.Material).dispose(); }, [lineObject]);
    if (!visible) return null;
    return <primitive object={lineObject} />;
}

function MLEMarker({ visible }: { visible: boolean }) {
    const peakY = getDensity(FIXED_B, MLE_X);

    const dropLine = useMemo(() => {
        const pts = [
            new THREE.Vector3(FIXED_B, peakY, MLE_X),
            new THREE.Vector3(FIXED_B, 0, MLE_X),
            new THREE.Vector3(0, 0, MLE_X),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: '#ec4899' });
        return new THREE.Line(geo, mat);
    }, [peakY]);

    useEffect(() => () => { dropLine.geometry.dispose(); (dropLine.material as THREE.Material).dispose(); }, [dropLine]);
    if (!visible) return null;
    return (
        <group>
            <mesh position={[FIXED_B, peakY, MLE_X]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial color="#ec4899" />
            </mesh>
            <primitive object={dropLine} />
            <Html position={[FIXED_B, peakY + 0.8, MLE_X]} center distanceFactor={8}>
                <div style={{
                    color: '#f472b6',
                    fontWeight: 700,
                    fontSize: '12px',
                    background: 'rgba(15,23,42,0.92)',
                    border: '1px solid #ec4899',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                }}>
                    MLE: x̂ = 3
                </div>
            </Html>
        </group>
    );
}

function AxisLine({ start, end, color }: { start: THREE.Vector3; end: THREE.Vector3; color: string }) {
    const lineObject = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geo, mat);
    }, [start, end, color]);
    useEffect(() => () => { lineObject.geometry.dispose(); (lineObject.material as THREE.Material).dispose(); }, [lineObject]);
    return <primitive object={lineObject} />;
}

function Axes() {
    return (
        <group>
            <AxisLine
                start={new THREE.Vector3(-RANGE, 0, 0)}
                end={new THREE.Vector3(RANGE + 0.5, 0, 0)}
                color="#ef4444"
            />
            <AxisLine
                start={new THREE.Vector3(0, 0, -RANGE)}
                end={new THREE.Vector3(0, 0, RANGE + 0.5)}
                color="#3b82f6"
            />
            <AxisLine
                start={new THREE.Vector3(0, 0, 0)}
                end={new THREE.Vector3(0, 3.5, 0)}
                color="#22c55e"
            />

            <Html position={[RANGE + 1, 0.3, 0]} center>
                <div style={{ color: '#f87171', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', pointerEvents: 'none', textShadow: '0 0 8px rgba(0,0,0,0.9)' }}>
                    Data (b)
                </div>
            </Html>
            <Html position={[0, 0.3, RANGE + 1]} center>
                <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', pointerEvents: 'none', textShadow: '0 0 8px rgba(0,0,0,0.9)' }}>
                    Parameter (x)
                </div>
            </Html>
            <Html position={[0, 3.8, 0]} center>
                <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', pointerEvents: 'none', textShadow: '0 0 8px rgba(0,0,0,0.9)' }}>
                    5 × density
                </div>
            </Html>
        </group>
    );
}

function ProbLabel({ visible }: { visible: boolean }) {
    const peakY = getDensity(FIXED_X * A, FIXED_X);
    if (!visible) return null;
    return (
        <Html position={[FIXED_X * A, peakY + 0.9, FIXED_X]} center distanceFactor={8}>
            <div style={{
                color: '#34d399',
                fontSize: '12px',
                background: 'rgba(15,23,42,0.92)',
                border: '1px solid rgba(52,211,153,0.4)',
                borderRadius: '8px',
                padding: '4px 8px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
            }}>
                <div style={{ fontWeight: 700 }}>Probability Curve</div>
                <div>P(b | x=1)</div>
            </div>
        </Html>
    );
}

function LikeLabel({ visible }: { visible: boolean }) {
    const peakY = getDensity(FIXED_B, MLE_X);
    if (!visible) return null;
    return (
        <Html position={[FIXED_B, peakY + 1.5, MLE_X]} center distanceFactor={8}>
            <div style={{
                color: '#fbbf24',
                fontSize: '12px',
                background: 'rgba(15,23,42,0.92)',
                border: '1px solid rgba(251,191,36,0.4)',
                borderRadius: '8px',
                padding: '4px 8px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
            }}>
                <div style={{ fontWeight: 700 }}>Likelihood Curve</div>
                <div>L(x | b=4.5)</div>
            </div>
        </Html>
    );
}

// Pre-compute curve points outside render
const PROB_CURVE_POINTS = (() => {
    const pts: THREE.Vector3[] = [];
    for (let t = -RANGE; t <= RANGE; t += 0.1) {
        pts.push(new THREE.Vector3(t, getDensity(t, FIXED_X) + 0.05, FIXED_X));
    }
    return pts;
})();

const LIKE_CURVE_POINTS = (() => {
    const pts: THREE.Vector3[] = [];
    for (let t = -RANGE; t <= RANGE; t += 0.1) {
        pts.push(new THREE.Vector3(FIXED_B, getDensity(FIXED_B, t) + 0.05, t));
    }
    return pts;
})();

function Scene({ mode }: { mode: 'probability' | 'likelihood' }) {
    const isProbMode = mode === 'probability';

    return (
        <>
            <color attach="background" args={['#0b0f19']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            <gridHelper args={[14, 14, 0x334155, 0x1e293b]} position={[0, -0.01, 0]} />

            <Axes />
            <GaussianSurface mode={mode} />

            {/* Probability mode elements */}
            <CuttingPlane visible={isProbMode} axis="z" pos={FIXED_X} color="#10b981" />
            <ThreeLine visible={isProbMode} points={PROB_CURVE_POINTS} color="#10b981" />
            <ProbLabel visible={isProbMode} />

            {/* Likelihood mode elements */}
            <CuttingPlane visible={!isProbMode} axis="x" pos={FIXED_B} color="#f59e0b" />
            <ThreeLine visible={!isProbMode} points={LIKE_CURVE_POINTS} color="#f59e0b" />
            <LikeLabel visible={!isProbMode} />
            <MLEMarker visible={!isProbMode} />

            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </>
    );
}

// --- Main Component ---

export default function ProbabilityVsLikelihood() {
    const { topicId } = useParams();
    const [mode, setMode] = useState<'probability' | 'likelihood'>('probability');
    const isProbMode = mode === 'probability';

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                    Forward vs Inverse Problem
                </h2>
                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Linear system with Gaussian noise
                </p>
            </div>

            {/* Formula box */}
            <div style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '12px',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <Latex formula="b = Ax + \epsilon" display />
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginBottom: '8px' }}>
                    where A = 1.5 and ε ~ N(0,1)
                </p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px' }}>
                    <Latex formula="f(b \mid x) = \frac{1}{\sqrt{2\pi}} e^{-\frac{1}{2}(b - Ax)^2}" display />
                </div>
            </div>

            <p style={{ fontSize: '12px', color: '#cbd5e1' }}>Vertical height is 5 × density. A density value is not the probability of a single continuous observation. The likelihood slice varies x while holding the observation fixed.</p>
            {/* Mode buttons */}
            <div>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    View Mode
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                        <button
                            onClick={() => setMode('probability')}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #334155',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '12px',
                                background: isProbMode ? '#3b82f6' : '#1e293b',
                                color: isProbMode ? 'white' : '#94a3b8',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <span>→</span> Forward / Probability
                        </button>
                        <p style={{
                            fontSize: '11px',
                            color: '#cbd5e1',
                            marginTop: '6px',
                            paddingLeft: '8px',
                            borderLeft: `2px solid ${isProbMode ? '#10b981' : '#334155'}`,
                            lineHeight: 1.5,
                            opacity: isProbMode ? 1 : 0.4,
                            transition: 'opacity 0.2s, border-color 0.2s',
                        }}>
                            Fix x = 1. The green curve predicts data b. Peaks at b = Ax = 1.5.
                        </p>
                    </div>

                    <div>
                        <button
                            onClick={() => setMode('likelihood')}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #334155',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '12px',
                                background: !isProbMode ? '#f59e0b' : '#1e293b',
                                color: !isProbMode ? 'white' : '#94a3b8',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <span>←</span> Inverse / Likelihood
                        </button>
                        <p style={{
                            fontSize: '11px',
                            color: '#cbd5e1',
                            marginTop: '6px',
                            paddingLeft: '8px',
                            borderLeft: `2px solid ${!isProbMode ? '#f59e0b' : '#334155'}`,
                            lineHeight: 1.5,
                            opacity: !isProbMode ? 1 : 0.4,
                            transition: 'opacity 0.2s, border-color 0.2s',
                        }}>
                            Fix b = 4.5. The orange curve infers x. The pink dot is the MLE: <Latex formula="\hat{x} = b/A = 3" />.
                        </p>
                    </div>
                </div>
            </div>

            {/* Key insight */}
            <div style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '10px',
                padding: '12px',
            }}>
                <p style={{ fontSize: '11px', color: '#a5b4fc', lineHeight: 1.5 }}>
                    <b style={{ color: '#818cf8' }}>Key insight:</b> The 3D surface f(b|x) is the same object.
                    Slicing it parallel to the b-axis gives a <span style={{ color: '#34d399' }}>probability</span> distribution.
                    Slicing parallel to the x-axis gives a <span style={{ color: '#fbbf24' }}>likelihood</span> function.
                </p>
            </div>

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic' }}>
                Drag to rotate · Scroll to zoom
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas frameloop="demand"
                dpr={[1, 1.5]}
                camera={{ position: [10, 8, 10], fov: 55 }}
                aria-label="3D Gaussian surface showing probability distribution vs likelihood function for linear model"
            >
                <Scene mode={mode} />
            </SceneCanvas>
        </SceneContainer>
    );
}
