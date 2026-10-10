import { SceneContainer } from '../../components/layout/SceneContainer';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo } from 'react';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* Math utilities */
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

type FunctionType = 'sin' | 'exp' | 'log';

const getDeriv = (f: FunctionType, n: number, a: number): number => {
    if (f === 'sin') {
        return [Math.sin(a), Math.cos(a), -Math.sin(a), -Math.cos(a)][n % 4];
    }
    if (f === 'exp') return Math.exp(a);
    if (f === 'log') {
        const safeA = Math.max(a, -0.99);
        if (n === 0) return Math.log(1 + safeA);
        return (Math.pow(-1, n - 1) * factorial(n - 1)) / Math.pow(1 + safeA, n);
    }
    return 0;
};

const targetFunc = (x: number, func: FunctionType): number => {
    if (func === 'sin') return Math.sin(x);
    if (func === 'exp') return Math.exp(x);
    if (func === 'log') return x > -1 ? Math.log(1 + x) : -5;
    return 0;
};

const polyFunc = (x: number, n: number, a: number, func: FunctionType): number => {
    let sum = 0;
    const safeA = func === 'log' ? Math.max(a, -0.99) : a;
    for (let i = 0; i <= n; i++) {
        const term = (getDeriv(func, i, safeA) / factorial(i)) * Math.pow(x - safeA, i);
        if (isFinite(term)) sum += term;
    }
    return sum;
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/* Error Ribbon Component */
function ErrorRibbon({
    n,
    a,
    func,
    resolution = 80,
}: {
    n: number;
    a: number;
    func: FunctionType;
    resolution?: number;
}) {
    const geometry = useMemo(() => {
        const errPoints: number[] = [];
        const xMin = -8;
        const xMax = 8;
        const step = (xMax - xMin) / resolution;

        for (let x = xMin + step; x <= xMax; x += step) {
            const prevX = x - step;
            if (func === 'log' && prevX <= -1) continue;

            let yF = targetFunc(x, func);
            let yP = polyFunc(x, n, a, func);
            let prevYF = targetFunc(prevX, func);
            let prevYP = polyFunc(prevX, n, a, func);

            if (!isFinite(yF)) yF = 0;
            if (!isFinite(yP)) yP = 0;
            if (!isFinite(prevYF)) prevYF = 0;
            if (!isFinite(prevYP)) prevYP = 0;

            yF = clamp(yF, -10, 10);
            yP = clamp(yP, -10, 10);
            prevYF = clamp(prevYF, -10, 10);
            prevYP = clamp(prevYP, -10, 10);

            const err = clamp(Math.abs(yF - yP), 0, 15);
            const prevErr = clamp(Math.abs(prevYF - prevYP), 0, 15);

            // Triangle 1
            errPoints.push(prevX, prevYP, 0);
            errPoints.push(x, yP, 0);
            errPoints.push(x, yF, err);

            // Triangle 2
            errPoints.push(prevX, prevYP, 0);
            errPoints.push(x, yF, err);
            errPoints.push(prevX, prevYF, prevErr);
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(errPoints, 3));
        geom.computeVertexNormals();
        return geom;
    }, [n, a, func, resolution]);

    return (
        <mesh geometry={geometry}>
            <meshPhongMaterial
                color="#10b981"
                side={THREE.DoubleSide}
                transparent
                opacity={0.6}
                flatShading
            />
        </mesh>
    );
}

/* Function Line */
function FunctionLine({
    func,
    n,
    a,
    isPolynomial,
    resolution = 100,
}: {
    func: FunctionType;
    n: number;
    a: number;
    isPolynomial: boolean;
    resolution?: number;
}) {
    const points = useMemo(() => {
        const pts: THREE.Vector3[] = [];
        const xMin = -8;
        const xMax = 8;
        const step = (xMax - xMin) / resolution;

        for (let x = xMin; x <= xMax; x += step) {
            if (func === 'log' && x <= -1) continue;
            let y = isPolynomial ? polyFunc(x, n, a, func) : targetFunc(x, func);
            if (!isFinite(y)) y = 0;
            y = clamp(y, -10, 10);
            pts.push(new THREE.Vector3(x, y, 0));
        }
        return pts;
    }, [func, n, a, isPolynomial, resolution]);

    return <Line points={points} color={isPolynomial ? '#10b981' : '#ffffff'} lineWidth={2} />;
}

/* Anchor Sphere */
function AnchorSphere({ a, func }: { a: number; func: FunctionType }) {
    const safeA = func === 'log' ? Math.max(a, -0.99) : a;
    const y = targetFunc(safeA, func);
    return (
        <mesh position={[safeA, y, 0]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshBasicMaterial color="#fbbf24" />
        </mesh>
    );
}

/* Info Panel */
function InfoPanel({
    n,
    a,
    func,
    onNChange,
    onAChange,
    onFuncChange,
}: {
    n: number;
    a: number;
    func: FunctionType;
    onNChange: (val: number) => void;
    onAChange: (val: number) => void;
    onFuncChange: (val: FunctionType) => void;
}) {
    return (
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
                        fontSize: '22px',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '6px',
                    }}
                >
                    Taylor Remainder
                </h2>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                    The <strong>Z-axis (depth)</strong> shows the gap between the displayed function and polynomial. Watch
                    the error "well" form around the expansion point.
                </p>
            </div>

            {/* Controls */}
            <div
                style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                <div>
                    <label
                        style={{
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            color: '#94a3b8',
                            marginBottom: '8px',
                            display: 'block',
                        }}
                    >
                        Function
                    </label>
                    <select
                        aria-label="Function"
                        value={func}
                        onChange={(e) => onFuncChange(e.target.value as FunctionType)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: '#050508',
                            color: '#f8fafc',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="sin">Sine Wave</option>
                        <option value="exp">Exponential</option>
                        <option value="log">Logarithm</option>
                    </select>
                </div>

                <div>
                    <label
                        style={{
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            color: '#94a3b8',
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}
                    >
                        <span>Degree (n)</span>
                        <span style={{ color: '#10b981' }}>{n}</span>
                    </label>
                    <input
                        aria-label="Degree"
                        type="range"
                        min="0"
                        max="10"
                        value={n}
                        onChange={(e) => onNChange(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#10b981' }}
                    />
                </div>

                <div>
                    <label
                        style={{
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            color: '#94a3b8',
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}
                    >
                        <span>Center (a)</span>
                        <span style={{ color: '#10b981' }}>{a.toFixed(1)}</span>
                    </label>
                    <input
                        aria-label="Center"
                        type="range"
                        min={func === 'log' ? -0.9 : -3}
                        max="3"
                        step="0.1"
                        value={a}
                        onChange={(e) => onAChange(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#10b981' }}
                    />
                </div>
            </div>

            {/* Legend */}
            <div
                style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '3px', background: '#ffffff' }} />
                    <span style={{ fontSize: '13px', color: '#e2e8f0' }}>f(x) — Actual function</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '3px', background: '#10b981' }} />
                    <span style={{ fontSize: '13px', color: '#e2e8f0' }}>P_n(x) — Taylor polynomial</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                        style={{ width: '24px', height: '16px', background: '#10b981', opacity: 0.6 }}
                    />
                    <span style={{ fontSize: '13px', color: '#e2e8f0' }}>|f(x) - P_n(x)| — Error ribbon</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                        style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: '#fbbf24',
                        }}
                    />
                    <span style={{ fontSize: '13px', color: '#e2e8f0' }}>Expansion point (a)</span>
                </div>
            </div>
        </div>
    );
}

/* Main Component */
export default function TaylorRemainder() {
    const [n, setN] = useState(3);
    const [a, setA] = useState(0);
    const [func, setFunc] = useState<FunctionType>('sin');

    return (
        <SceneContainer backUrl="/calculus" controls={<InfoPanel n={n} a={a} func={func} onNChange={setN} onAChange={setA}
            onFuncChange={value => { setFunc(value); if (value === 'log' && a <= -1) setA(0); }} />}>
            <SceneCanvas frameloop="demand"
                camera={{ position: [12, 8, 12], fov: 50 }}
                dpr={[1, 1.5]}
                aria-label="3D visualization of Taylor series remainder showing error between original function and polynomial approximation"
            >
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 7]} intensity={0.8} />

                <gridHelper args={[20, 20, '#334155', '#0a0a0f']} />

                <ErrorRibbon n={n} a={a} func={func} />
                <FunctionLine func={func} n={n} a={a} isPolynomial={false} />
                <FunctionLine func={func} n={n} a={a} isPolynomial />
                <AnchorSphere a={a} func={func} />

                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
            </SceneCanvas>
        </SceneContainer>
    );
}
