import { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';
import { Arrow } from '../../components/3d/Arrow';
import { Label } from '../../components/3d/Label';
import { RotateCcw, Shuffle, Scaling, MoveDiagonal } from 'lucide-react';

// --- Types & Constants ---
type Matrix3Tuple = [number, number, number, number, number, number, number, number, number];
const IDENTITY: Matrix3Tuple = [2, 0, 0, 0, 1.5, 0, 0, 0, 0.5]; // Default start

// --- Math Helpers ---
const applyMatrix = (v: THREE.Vector3, m: Matrix3Tuple): THREE.Vector3 => {
    const mat = new THREE.Matrix3();
    mat.set(...m); // Three.js set() takes arguments in row-major order (n11, n12, n13...)
    return v.clone().applyMatrix3(mat);
};

const isEigenvector = (v: THREE.Vector3, av: THREE.Vector3): { isEigen: boolean; lambda: number | null } => {
    const lenV = v.lengthSq();
    const lenAv = av.lengthSq();

    // Trivial zeros
    if (lenAv < 0.0001 && lenV > 0.0001) return { isEigen: true, lambda: 0 };
    if (lenV < 0.0001) return { isEigen: false, lambda: null };

    // Cross product check for parallel
    const vNorm = v.clone().normalize();
    const avNorm = av.clone().normalize();
    const cross = new THREE.Vector3().crossVectors(vNorm, avNorm);

    // Tolerance
    const isParallel = cross.lengthSq() < 0.0005;

    if (isParallel) {
        const dot = av.dot(v);
        return { isEigen: true, lambda: dot / lenV };
    }
    return { isEigen: false, lambda: null };
};

// --- Components ---

const format = (n: number) => n.toFixed(1).replace(/\.0$/, '');

const MatrixDisplay = ({ data, cols = 3 }: { data: number[], cols: number }) => (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: '4px',
            borderLeft: '2px solid #94a3b8',
            borderRight: '2px solid #94a3b8',
            borderRadius: '6px',
            padding: '2px 6px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            textAlign: 'center'
        }}>
            {data.map((n, i) => <span key={i}>{format(n)}</span>)}
        </div>
    );


function MathEquation({ matrix, vector, result, lambda, isEigen }: {
    matrix: Matrix3Tuple;
    vector: THREE.Vector3;
    result: THREE.Vector3;
    lambda: number | null;
    isEigen: boolean;
}) {

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.4)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: 'auto',
            overflowX: 'auto'
        }}>
            {/* Matrix A */}
            <MatrixDisplay data={matrix} cols={3} />

            {/* Vector x */}
            <MatrixDisplay data={[vector.x, vector.y, vector.z]} cols={1} />

            <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>=</span>

            {/* Result Ax */}
            {isEigen && lambda !== null ? (
                // Eigen Form: λx
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: '14px' }}>
                        {lambda.toFixed(2)}
                    </span>
                    <MatrixDisplay data={[vector.x, vector.y, vector.z]} cols={1} />
                </div>
            ) : (
                // Standard Form
                <MatrixDisplay data={[result.x, result.y, result.z]} cols={1} />
            )}
        </div>
    );
}

function EigenScene({
    matrix,
    vector,
    setEigenState
}: {
    matrix: Matrix3Tuple;
    vector: THREE.Vector3;
    setEigenState: (s: { isEigen: boolean, lambda: number | null }) => void;
}) {
    const result = useMemo(() => applyMatrix(vector, matrix), [vector, matrix]);

    // Check Eigenflow
    useEffect(() => {
        const { isEigen, lambda } = isEigenvector(vector, result);
        setEigenState({ isEigen, lambda });
    }, [vector, result, setEigenState]);

    const { isEigen } = isEigenvector(vector, result);

    // Eigen line visualizer (infinite line)
    const linePoints = useMemo(() => {
        if (!isEigen) return null;
        const dir = vector.clone().normalize().multiplyScalar(50);
        return [dir.clone().negate(), dir];
    }, [vector, isEigen]);

    return (
        <group>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1} />

            {/* Grid & Axes */}
            <gridHelper args={[20, 20, '#1e293b', '#0f172a']} position={[0, -0.01, 0]} />
            <axesHelper args={[2]} />
            <Label text="X" position={[2.2, 0, 0]} color="#ef4444" fontSize={0.8} />
            <Label text="Y" position={[0, 2.2, 0]} color="#22c55e" fontSize={0.8} />
            <Label text="Z" position={[0, 0, 2.2]} color="#3b82f6" fontSize={0.8} />

            {/* Input Vector x (Blue) */}
            <Arrow direction={[vector.x, vector.y, vector.z]} color="#3b82f6" lineWidth={4} />
            {vector.lengthSq() > 0.1 && (
                <Label text="x" position={[vector.x, vector.y, vector.z]} color="#3b82f6" fontSize={0.6} />
            )}

            {/* Output Vector Ax (Red or Gold) */}
            <Arrow
                direction={[result.x, result.y, result.z]}
                color={isEigen ? "#facc15" : "#ef4444"}
                lineWidth={4}
            />
            {result.lengthSq() > 0.1 && (
                <Label text="Ax" position={[result.x, result.y, result.z]} color={isEigen ? "#facc15" : "#ef4444"} fontSize={0.6} />
            )}

            {/* Eigenline */}
            {isEigen && linePoints && (
                <Line points={linePoints} color="#facc15" opacity={0.3} transparent lineWidth={1} />
            )}
        </group>
    );
}

export default function Eigenvalues() {
    const { topicId } = useParams();

    // State
    const [matrix, setMatrix] = useState<Matrix3Tuple>(IDENTITY);
    const [vector, setVector] = useState(new THREE.Vector3(1, 1, 1));
    const [eigenState, setEigenState] = useState<{ isEigen: boolean; lambda: number | null }>({ isEigen: false, lambda: null });

    // Handlers
    const updateMatrix = (idx: number, val: number) => {
        const newM = [...matrix] as Matrix3Tuple;
        newM[idx] = val;
        setMatrix(newM);
    };

    const updateVector = (axis: 'x' | 'y' | 'z', val: number) => {
        const newV = vector.clone();
        newV[axis] = val;
        setVector(newV);
    };

    const reset = () => {
        setMatrix([1, 0, 0, 0, 1, 0, 0, 0, 1]); // Identity
        setVector(new THREE.Vector3(1, 1, 1));
    };

    const autoFind = () => {
        // Power Iteration
        const v = new THREE.Vector3(1, 1, 1).normalize();
        const m = new THREE.Matrix3();
        m.set(...matrix);

        for (let i = 0; i < 30; i++) {
            v.applyMatrix3(m);
            if (v.lengthSq() < 0.000001) break;
            v.normalize();
        }

        // Scale for visibility
        v.multiplyScalar(2);
        setVector(v);
    };

    const setPreset = (type: 'identity' | 'scale' | 'shear' | 'rotation' | 'random') => {
        let m: Matrix3Tuple = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        if (type === 'scale') m = [2, 0, 0, 0, 1.5, 0, 0, 0, 0.5];
        if (type === 'shear') m = [1, 1, 0, 0, 1, 0, 0, 0, 1];
        if (type === 'rotation') m = [0, -1, 0, 1, 0, 0, 0, 0, 1];
        if (type === 'random') {
            const r = () => parseFloat((Math.random() * 2 - 1).toFixed(1));
            m = [r(), r(), r(), r(), r(), r(), r(), r(), r()];
        }
        setMatrix(m);
    };

    const result = applyMatrix(vector, matrix);

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', width: '340px' }}>
            <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {eigenState.isEigen ? '✨ Eigenvector Found!' : 'Eigenvalue Visualizer'}
                </h1>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
                    {eigenState.isEigen
                        ? `Eigenvalue λ = ${eigenState.lambda?.toFixed(2)}`
                        : "Align the output vector (Red) with input (Blue)."}
                </p>
            </div>

            {/* Matrix Input */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Matrix A</span>
                    <button onClick={reset} style={{ fontSize: '11px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>Reset</button>
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #334155'
                }}>
                    {matrix.map((val, i) => (
                        <input
                            key={i}
                            type="number"
                            step="0.1"
                            value={val}
                            onChange={(e) => updateMatrix(i, parseFloat(e.target.value))}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: '1px solid #475569',
                                borderRadius: '4px',
                                color: 'white',
                                textAlign: 'center',
                                fontSize: '12px',
                                padding: '4px'
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Vector Sliders */}
            <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Input Vector x</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {['x', 'y', 'z'].map((axis) => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, width: '12px', color: axis === 'x' ? '#ef4444' : axis === 'y' ? '#22c55e' : '#3b82f6' }}>
                                {axis.toUpperCase()}
                            </span>
                            <input
                                type="range"
                                min="-3" max="3" step="0.1"
                                value={vector[axis as 'x' | 'y' | 'z']}
                                onChange={(e) => updateVector(axis as 'x' | 'y' | 'z', parseFloat(e.target.value))}
                                style={{ flex: 1, accentColor: '#3b82f6' }}
                            />
                            <span style={{ fontSize: '11px', width: '24px', textAlign: 'right', color: '#cbd5e1' }}>
                                {vector[axis as 'x' | 'y' | 'z'].toFixed(1)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {([
                    { id: 'scale', label: 'Scale', icon: Scaling },
                    { id: 'shear', label: 'Shear', icon: MoveDiagonal },
                    { id: 'rotation', label: 'Rotation', icon: RotateCcw },
                    { id: 'random', label: 'Random', icon: Shuffle },
                ] as const).map((p) => (
                    <button
                        key={p.id}
                        onClick={() => setPreset(p.id)}
                        style={{
                            padding: '8px',
                            borderRadius: '6px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#e2e8f0',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <p.icon size={12} /> {p.label}
                    </button>
                ))}
            </div>

            <button
                onClick={autoFind}
                style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
            >
                Auto-Find Eigenvector
            </button>

            <MathEquation matrix={matrix} vector={vector} result={result} isEigen={eigenState.isEigen} lambda={eigenState.lambda} />
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <Canvas camera={{ position: [5, 5, 8], fov: 45 }} aria-label="Eigenvalue Visualizer">
                <OrbitControls enableDamping dampingFactor={0.05} />
                <color attach="background" args={['#0b0f19']} />
                <fog attach="fog" args={['#0b0f19', 10, 25]} />
                <EigenScene matrix={matrix} vector={vector} setEigenState={setEigenState} />
            </Canvas>
        </SceneContainer>
    );
}
