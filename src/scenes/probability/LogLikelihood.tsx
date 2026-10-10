import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo, useEffect } from 'react';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Maximize, Tent, Move3d } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

// --- Types ---
interface Camper {
    x: number;
    z: number;
}

// --- Constants ---
const CAMPERS: Camper[] = [
    { x: -2, z: -1 }, { x: -1.5, z: 1 }, { x: 0, z: 0 },
    { x: 1, z: -2 }, { x: 1.5, z: 1.5 }, { x: 2, z: -0.5 },
    { x: 3, z: 2 }, { x: -3, z: -2 }, { x: 0.5, z: 3 }
];

// --- Helper Functions ---
const calculateScore = (mx: number, mz: number, s: number) => {
    return CAMPERS.reduce((acc, p) => {
        const distSq = Math.pow(p.x - mx, 2) + Math.pow(p.z - mz, 2);
        const logLikelihood = -Math.log(2 * Math.PI) - 2 * Math.log(s) - (distSq / (2 * Math.pow(s, 2)));
        return acc + logLikelihood;
    }, 0);
};

// --- Sub-Components ---

export function ProbabilityDome({ muX, muZ, sigma }: { muX: number, muZ: number, sigma: number }) {
    const geometry = useMemo(() => {
        const dome = new THREE.PlaneGeometry(12, 12, 60, 60);
        // Work in world XZ coordinates so increasing muZ moves the peak toward +Z.
        dome.rotateX(-Math.PI / 2);
        const positions = dome.getAttribute('position');
        const denominator = 2 * sigma ** 2;
        const peakHeight = 15 / sigma;
        for (let i = 0; i < positions.count; i++) {
            const distanceSquared = (positions.getX(i) - muX) ** 2 + (positions.getZ(i) - muZ) ** 2;
            positions.setY(i, Math.max(0.05, peakHeight * Math.exp(-distanceSquared / denominator)));
        }
        positions.needsUpdate = true;
        dome.computeVertexNormals();
        dome.computeBoundingSphere();
        return dome;
    }, [muX, muZ, sigma]);

    // These shared geometries are supplied as mesh props rather than R3F-managed children.
    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <group>
            <mesh geometry={geometry}>
                <meshPhongMaterial
                    color="#3b82f6"
                    transparent
                    opacity={0.5}
                    side={THREE.DoubleSide}
                    shininess={60}
                    flatShading={false}
                />
            </mesh>
            <mesh geometry={geometry}>
                <meshBasicMaterial
                    color="#2563eb"
                    wireframe
                    transparent
                    opacity={0.1}
                />
            </mesh>
        </group>
    );
}

function Campers({ muX, muZ, sigma }: { muX: number, muZ: number, sigma: number }) {
    return (
        <group>
            {CAMPERS.map((p, i) => {
                const distSq = Math.pow(p.x - muX, 2) + Math.pow(p.z - muZ, 2);
                const mahalanobisSq = distSq / Math.pow(sigma, 2);
                const isOutlier = mahalanobisSq > 6.25;
                const color = isOutlier ? "#ef4444" : "#94a3b8";

                return (
                    <mesh key={i} position={[p.x, 0.2, p.z]} castShadow>
                        <sphereGeometry args={[0.2, 16, 16]} />
                        <meshPhongMaterial color={color} />
                    </mesh>
                );
            })}
        </group>
    );
}

function Labels() {
    return (
        <group>
            <Html position={[9, 1, 0]} transform sprite>
                <div style={{ color: '#f87171', fontWeight: 700, fontSize: '14px', userSelect: 'none', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>X (μx)</div>
            </Html>
            <Html position={[0, 1, 9]} transform sprite>
                <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '14px', userSelect: 'none', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>Z (μz)</div>
            </Html>
            <Html position={[0, 8, 0]} transform sprite>
                <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '14px', userSelect: 'none', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>Density (scaled height)</div>
            </Html>
        </group>
    );
}

// --- Main Scene ---

export default function LogLikelihood() {
    const { topicId } = useParams();
    const [muX, setMuX] = useState(0);
    const [muZ, setMuZ] = useState(0);
    const [sigma, setSigma] = useState(2);

    const currentScore = calculateScore(muX, muZ, sigma);

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '320px' }}>
            <p style={{ fontSize: '12px', color: '#cbd5e1' }}>The dome height is visually rescaled with σ and clipped at 0.05; its height is not a calibrated density axis. The log-likelihood score uses the exact Gaussian density for all nine observations.</p>
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tent size={20} /> Log-Likelihood Visualizer
                </h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Now using <b>Log-Likelihood</b>. Missing a point (red) creates a huge penalty.
                </p>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#60a5fa' }}>
                    <Maximize size={20} />
                </div>
                <div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Log-Likelihood</div>
                    <div style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 900, lineHeight: 1, color: currentScore < -50 ? '#ef4444' : '#60a5fa' }}>
                        {currentScore.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Position Controls */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    <Move3d size={14} color="#94a3b8" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>Position Parameters</span>
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>X-Position (μx)</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>{muX.toFixed(2)}</span>
                    </div>
                    <input aria-label="X-Position"
                        type="range" min="-5" max="5" step="0.1" value={muX}
                        onChange={e => setMuX(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#3b82f6' }}
                    />
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Z-Position (μz)</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>{muZ.toFixed(2)}</span>
                    </div>
                    <input aria-label="Z-Position"
                        type="range" min="-5" max="5" step="0.1" value={muZ}
                        onChange={e => setMuZ(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#3b82f6' }}
                    />
                </div>
            </div>

            {/* Shape Controls */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>Shape Parameters</span>
                </div>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Spread (σ)</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>{sigma.toFixed(2)}</span>
                    </div>
                    <input aria-label="Spread"
                        type="range" min="0.1" max="4" step="0.1" value={sigma}
                        onChange={e => setSigma(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#6366f1' }}
                    />
                    <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', lineHeight: 1.4 }}>
                        Try making this very small (0.1). You will see the "needle" effect, but the score will drop because red points are punished.
                    </p>
                </div>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px', padding: '12px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#818cf8', textTransform: 'uppercase', marginBottom: '4px' }}>The Rule</h3>
                <p style={{ fontSize: '11px', color: '#a5b4fc', lineHeight: 1.4 }}>
                    We are now adding <b>Logarithms</b>. <br />
                    In(0) = -∞ <br />
                    This means if you ignore even one point (turn it red), your score gets destroyed. You must balance the peak height with covering everyone!
                </p>
            </div>

        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas frameloop="demand" dpr={[1, 1.5]} shadows camera={{ position: [12, 10, 12], fov: 45 }} aria-label="3D visualization of log-likelihood surface with maximum likelihood estimation">
                <color attach="background" args={['#0b0f19']} />
                <fog attach="fog" args={['#0b0f19', 15, 30]} />

                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 10, 5]} intensity={1.0} castShadow />

                {/* Floor */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[16, 16]} />
                    <meshPhongMaterial color="#0f172a" side={THREE.DoubleSide} />
                </mesh>
                <gridHelper args={[16, 16, 0x334155, 0x1e293b]} position={[0, 0.01, 0]} />

                {/* Axes */}
                <axesHelper args={[3]} position={[0, 0.05, 0]} />
                <Labels />

                <ProbabilityDome muX={muX} muZ={muZ} sigma={sigma} />
                <Campers muX={muX} muZ={muZ} sigma={sigma} />

                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
            </SceneCanvas>
        </SceneContainer>
    );
}
