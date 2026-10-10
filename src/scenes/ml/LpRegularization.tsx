import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo } from 'react';

import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// --- Math helpers ---

function buildNormBallGeometry(pValue: number, radius: number): THREE.BufferGeometry {
    const detail = 40;
    const effectiveP = pValue === Infinity ? 16 : pValue;

    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= detail; i++) {
        const v = (i / detail) * Math.PI;
        for (let j = 0; j <= detail; j++) {
            const u = (j / detail) * 2 * Math.PI;

            const sinV = Math.sin(v);
            const cosV = Math.cos(v);
            const sinU = Math.sin(u);
            const cosU = Math.cos(u);

            const denom = Math.pow(
                Math.pow(Math.abs(sinV * cosU), effectiveP) +
                Math.pow(Math.abs(sinV * sinU), effectiveP) +
                Math.pow(Math.abs(cosV), effectiveP),
                1 / effectiveP,
            ) || 1;

            vertices.push(
                (sinV * cosU / denom) * radius,
                (sinV * sinU / denom) * radius,
                (cosV / denom) * radius,
            );
        }
    }

    for (let i = 0; i < detail; i++) {
        for (let j = 0; j < detail; j++) {
            const a = i * (detail + 1) + j;
            const b = a + 1;
            const c = (i + 1) * (detail + 1) + j;
            const d = c + 1;
            indices.push(a, b, d, a, d, c);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

function projectOntoNormBall(ols: THREE.Vector3, pValue: number, radius: number): THREE.Vector3 {
    const effectiveP = pValue === Infinity ? 50 : pValue;
    const norm = Math.pow(
        Math.pow(Math.abs(ols.x), effectiveP) +
        Math.pow(Math.abs(ols.y), effectiveP) +
        Math.pow(Math.abs(ols.z), effectiveP),
        1 / effectiveP,
    );
    if (norm <= radius) return ols.clone();
    const scale = radius / norm;
    return new THREE.Vector3(ols.x * scale, ols.y * scale, ols.z * scale);
}

// --- 3D sub-components ---

function NormBall({ pValue, radius }: { pValue: number; radius: number }) {
    const geometry = useMemo(
        () => buildNormBallGeometry(pValue, radius),
        [pValue, radius],
    );

    return (
        // key forces remount so flatShading change takes effect cleanly
        <mesh key={pValue} geometry={geometry}>
            <meshPhongMaterial
                color="#3b82f6"
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
                shininess={80}
                flatShading={pValue === 1}
            />
        </mesh>
    );
}

function OLSMarker({ position }: { position: THREE.Vector3 }) {
    return (
        <group position={position}>
            <mesh>
                <sphereGeometry args={[0.08, 12, 12]} />
                <meshBasicMaterial color="#facc15" />
            </mesh>
            {/* rotated sphere reads visually as an ellipsoid */}
            <mesh rotation={[0.4, 0.7, 0.2]}>
                <sphereGeometry args={[1, 24, 24]} />
                <meshStandardMaterial color="#facc15" wireframe transparent opacity={0.2} />
            </mesh>
        </group>
    );
}

function RegMarker({ position }: { position: THREE.Vector3 }) {
    return (
        <mesh position={position}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial color="#10b981" />
        </mesh>
    );
}

function ShrinkLine({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
    const obj = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const mat = new THREE.LineDashedMaterial({ color: '#10b981', dashSize: 0.2, gapSize: 0.1 });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        return line;
    }, [from, to]);
    return <primitive object={obj} />;
}

function SceneAxes() {
    const shared = { emissiveIntensity: 0.5 };
    return (
        <group>
            {/* X — red */}
            <mesh position={[2.5, 0, 0]}>
                <boxGeometry args={[5, 0.02, 0.02]} />
                <meshStandardMaterial color="#ff4444" emissive="#ff4444" {...shared} />
            </mesh>
            <mesh position={[5.5, 0, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color="#ff4444" />
            </mesh>

            {/* Y — green */}
            <mesh position={[0, 2.5, 0]}>
                <boxGeometry args={[0.02, 5, 0.02]} />
                <meshStandardMaterial color="#44ff44" emissive="#44ff44" {...shared} />
            </mesh>
            <mesh position={[0, 5.5, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color="#44ff44" />
            </mesh>

            {/* Z — blue */}
            <mesh position={[0, 0, 2.5]}>
                <boxGeometry args={[0.02, 0.02, 5]} />
                <meshStandardMaterial color="#4444ff" emissive="#4444ff" {...shared} />
            </mesh>
            <mesh position={[0, 0, 5.5]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color="#4444ff" />
            </mesh>
        </group>
    );
}

function Scene({ pValue, radius, olsVec, regVec }: {
    pValue: number;
    radius: number;
    olsVec: THREE.Vector3;
    regVec: THREE.Vector3;
}) {
    return (
        <>
            <color attach="background" args={['#020617']} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <spotLight position={[-10, 10, 10]} intensity={1} color="#3b82f6" />

            <gridHelper args={[20, 20, 0x1e293b, 0x0f172a]} position={[0, -0.01, 0]} />
            <SceneAxes />

            <NormBall pValue={pValue} radius={radius} />
            <OLSMarker position={olsVec} />
            <RegMarker position={regVec} />
            <ShrinkLine from={olsVec} to={regVec} />

            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </>
    );
}

// --- Descriptions ---

const DESC: Record<string, string> = {
    '1': 'L1 (Lasso) creates sharp corners that often sit exactly on the axes, forcing coefficients to zero.',
    '2': 'L2 (Ridge) is a smooth sphere that shrinks weights uniformly toward zero.',
    '3': 'As p increases, the norm ball transitions from an octahedron toward a cube.',
    'Infinity': 'L-Infinity (Max) creates a box that caps the absolute maximum value of any weight.',
};

const PENALTY_BTNS = [
    { label: 'L1 (Lasso)', val: 1 },
    { label: 'L2 (Ridge)', val: 2 },
    { label: 'L3', val: 3 },
    { label: 'L-Infinity', val: Infinity },
] as const;

// --- Main export ---

export default function LpRegularization() {
    const { topicId } = useParams<{ topicId: string }>();

    const [pValue, setPValue] = useState<number>(2);
    const [radius, setRadius] = useState(1.2);
    const [olsX, setOlsX] = useState(2.8);
    const [olsY, setOlsY] = useState(2.2);
    const [olsZ, setOlsZ] = useState(2.0);

    const olsVec = useMemo(() => new THREE.Vector3(olsX, olsY, olsZ), [olsX, olsY, olsZ]);
    const regVec = useMemo(() => projectOntoNormBall(olsVec, pValue, radius), [olsVec, pValue, radius]);

    const pLabel = pValue === Infinity ? '∞' : String(pValue);
    const descKey = pValue === Infinity ? 'Infinity' : String(pValue);

    const olsSliders = [
        { label: 'w1 (X)', val: olsX, set: setOlsX },
        { label: 'w2 (Y)', val: olsY, set: setOlsY },
        { label: 'w3 (Z)', val: olsZ, set: setOlsZ },
    ];

    const tableRows = [
        { label: 'w1', ols: olsX, reg: regVec.x },
        { label: 'w2', ols: olsY, reg: regVec.y },
        { label: 'w3', ols: olsZ, reg: regVec.z },
    ];

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                    Lp Norm Balls
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '11px' }}>
                    Explore how different penalties shape the constraint region.
                </p>
            </div>

            {/* Formula box */}
            <div style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '12px',
                textAlign: 'center',
            }}>
                <Latex formula="\min_w \; \mathcal{L}(w) \quad \text{s.t.} \quad \|w\|_p \leq t" display />
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Minimize loss subject to Lp constraint
                </p>
            </div>

            {/* Penalty type buttons */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Penalty Type (Lp)
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        p = {pLabel}
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {PENALTY_BTNS.map(({ label, val }) => (
                        <button
                            key={label}
                            onClick={() => setPValue(val)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #334155',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: pValue === val ? '#2563eb' : '#1e293b',
                                color: pValue === val ? 'white' : '#94a3b8',
                                transition: 'all 0.2s',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Constraint radius */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Constraint Radius (t)
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        {radius.toFixed(1)}
                    </span>
                </div>
                <input
                    type="range" min="0.5" max="3.5" step="0.1"
                    value={radius}
                    onChange={(e) => setRadius(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>

            {/* OLS position */}
            <div style={{ background: 'rgba(2, 6, 23, 0.4)', borderRadius: '8px', border: '1px solid #1e293b', padding: '12px' }}>
                <div style={{ color: '#facc15', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    OLS Solution (ŵ)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {olsSliders.map(({ label, val, set }) => (
                        <div key={label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                                <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>{val.toFixed(1)}</span>
                            </div>
                            <input
                                type="range" min="0" max="5" step="0.1"
                                value={val}
                                onChange={(e) => set(parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Weight comparison table */}
            <div style={{ background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)', padding: '12px' }}>
                <div style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Weight Comparison
                </div>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                            <th style={{ textAlign: 'left', paddingBottom: '6px', fontWeight: 600 }}>Weight</th>
                            <th style={{ textAlign: 'left', paddingBottom: '6px', fontWeight: 600 }}>OLS (ŵ)</th>
                            <th style={{ textAlign: 'left', paddingBottom: '6px', fontWeight: 600, color: '#34d399' }}>Regularized</th>
                        </tr>
                    </thead>
                    <tbody style={{ fontFamily: 'monospace' }}>
                        {tableRows.map(({ label, ols, reg }) => (
                            <tr key={label}>
                                <td style={{ paddingTop: '6px', color: '#94a3b8' }}>{label}</td>
                                <td style={{ paddingTop: '6px', color: 'white' }}>{ols.toFixed(2)}</td>
                                <td style={{ paddingTop: '6px', color: '#34d399' }}>{reg.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Description */}
            <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '4px' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>Blue Shell:</span>{' '}
                    The constraint region <Latex formula="\|w\|_p \leq t" />.
                </p>
                <p style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>Green Dot:</span>{' '}
                    Regularized solution projected onto the norm ball.
                </p>
                <p style={{ background: 'rgba(15,23,42,0.5)', padding: '10px', borderRadius: '6px', border: '1px solid #1e293b', fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>
                    {DESC[descKey]}
                </p>
            </div>

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>
                Drag to rotate · Scroll to zoom
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <SceneCanvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [7.5, 7.5, 7.5], fov: 45 }} aria-label="3D visualization of Lp norm balls showing L1, L2, L3, and L-infinity constraint regions">
                <Scene pValue={pValue} radius={radius} olsVec={olsVec} regVec={regVec} />
            </SceneCanvas>
        </SceneContainer>
    );
}
