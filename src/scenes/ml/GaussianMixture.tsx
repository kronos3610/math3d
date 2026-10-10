import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const K = 3;
const N = 400;
const ANIM_SPEED = 2.5;     // animProgress units per second
const VAR_FLOOR = 0.5;      // prevent collapse

const CLUSTER_COLORS = [
    new THREE.Color(1.0, 0.2, 0.2),
    new THREE.Color(0.2, 1.0, 0.2),
    new THREE.Color(0.2, 0.4, 1.0),
] as const;
const CLUSTER_HEX = ['#ff4444', '#44ff44', '#4466ff'] as const;
const DEFAULT_COLOR = new THREE.Color(0.5, 0.5, 0.5);

const TRUE_CLUSTERS = [
    { center: new THREE.Vector3(-8, 5, -8), spread: new THREE.Vector3(3, 2, 4) },
    { center: new THREE.Vector3(8, -2, -5), spread: new THREE.Vector3(4, 3, 2) },
    { center: new THREE.Vector3(0, 8, 10), spread: new THREE.Vector3(2, 5, 2) },
] as const;

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function boxMuller() {
    return Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
}

function gaussianPDF(x: THREE.Vector3, mean: THREE.Vector3, variance: THREE.Vector3) {
    const vx = Math.max(variance.x, 1e-3);
    const vy = Math.max(variance.y, 1e-3);
    const vz = Math.max(variance.z, 1e-3);
    const coef = 1 / (Math.pow(2 * Math.PI, 1.5) * Math.sqrt(vx * vy * vz));
    const exp = -0.5 * (
        (x.x - mean.x) ** 2 / vx +
        (x.y - mean.y) ** 2 / vy +
        (x.z - mean.z) ** 2 / vz
    );
    return coef * Math.exp(exp);
}

// ---------------------------------------------------------------------------
// GMM mutable state
// ---------------------------------------------------------------------------

interface GMMState {
    dataPoints: THREE.Vector3[];
    means: THREE.Vector3[];
    variances: THREE.Vector3[];
    targetMeans: THREE.Vector3[];
    targetVariances: THREE.Vector3[];
    weights: number[];
    responsibilities: number[][];
    animating: boolean;
    animProgress: number;
    geometryRev: number;       // bumped on reset
    responsibilityRev: number; // bumped on E-step
}

function emptyGMM(): GMMState {
    return {
        dataPoints: [], means: [], variances: [], targetMeans: [], targetVariances: [],
        weights: [], responsibilities: [],
        animating: false, animProgress: 0,
        geometryRev: 0, responsibilityRev: 0,
    };
}

function rebuildGMM(g: GMMState) {
    g.dataPoints = [];
    for (let i = 0; i < N; i++) {
        const c = TRUE_CLUSTERS[Math.floor(Math.random() * K)];
        g.dataPoints.push(new THREE.Vector3(
            c.center.x + boxMuller() * c.spread.x,
            c.center.y + boxMuller() * c.spread.y,
            c.center.z + boxMuller() * c.spread.z,
        ));
    }
    g.means = []; g.variances = []; g.targetMeans = []; g.targetVariances = []; g.weights = [];
    for (let k = 0; k < K; k++) {
        const m = new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 30,
        );
        g.means.push(m.clone());
        g.targetMeans.push(m.clone());
        g.variances.push(new THREE.Vector3(25, 25, 25));
        g.targetVariances.push(new THREE.Vector3(25, 25, 25));
        g.weights.push(1 / K);
    }
    g.responsibilities = Array.from({ length: N }, () => new Array(K).fill(1 / K));
    g.animating = false;
    g.animProgress = 0;
    g.geometryRev++;
}

function doEStep(g: GMMState): number {
    let logL = 0;
    for (let i = 0; i < N; i++) {
        const probs: number[] = new Array(K);
        let totalP = 0;
        for (let k = 0; k < K; k++) {
            const p = g.weights[k] * gaussianPDF(g.dataPoints[i], g.means[k], g.variances[k]);
            probs[k] = p;
            totalP += p;
        }
        for (let k = 0; k < K; k++) {
            g.responsibilities[i][k] = totalP > 0 ? probs[k] / totalP : 1 / K;
        }
        if (totalP > 0) logL += Math.log(totalP);
    }
    g.responsibilityRev++;
    return logL;
}

function doMStep(g: GMMState) {
    for (let k = 0; k < K; k++) {
        let Nk = 0;
        const newMean = new THREE.Vector3();
        for (let i = 0; i < N; i++) {
            Nk += g.responsibilities[i][k];
            newMean.x += g.dataPoints[i].x * g.responsibilities[i][k];
            newMean.y += g.dataPoints[i].y * g.responsibilities[i][k];
            newMean.z += g.dataPoints[i].z * g.responsibilities[i][k];
        }
        if (Nk <= 1e-3) continue;

        newMean.divideScalar(Nk);
        const newVar = new THREE.Vector3();
        for (let i = 0; i < N; i++) {
            const dx = g.dataPoints[i].x - newMean.x;
            const dy = g.dataPoints[i].y - newMean.y;
            const dz = g.dataPoints[i].z - newMean.z;
            newVar.x += dx * dx * g.responsibilities[i][k];
            newVar.y += dy * dy * g.responsibilities[i][k];
            newVar.z += dz * dz * g.responsibilities[i][k];
        }
        newVar.divideScalar(Nk);
        newVar.x = Math.max(newVar.x, VAR_FLOOR);
        newVar.y = Math.max(newVar.y, VAR_FLOOR);
        newVar.z = Math.max(newVar.z, VAR_FLOOR);

        g.targetMeans[k].copy(newMean);
        g.targetVariances[k].copy(newVar);
        g.weights[k] = Nk / N;
    }
    g.animating = true;
    g.animProgress = 0;
}

// ---------------------------------------------------------------------------
// 3D scene (everything that touches Three.js objects)
// ---------------------------------------------------------------------------

interface Scene3DProps {
    gmmRef: React.MutableRefObject<GMMState>;
    onAnimDone: () => void;
}

function Scene3D({ gmmRef, onAnimDone }: Scene3DProps) {
    const pointMeshRef = useRef<THREE.InstancedMesh>(null);
    const gaussianRefs = useRef<(THREE.Mesh | null)[]>([null, null, null]);

    const appliedGeometryRev = useRef(0);
    const appliedResponsibilityRev = useRef(0);

    const pointGeom = useMemo(() => new THREE.SphereGeometry(0.3, 16, 16), []);
    const pointMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0xffffff }), []);

    useEffect(() => () => {
        pointGeom.dispose();
        pointMat.dispose();
    }, [pointGeom, pointMat]);

    useFrame((_, delta) => {
        const g = gmmRef.current;
        const pm = pointMeshRef.current;

        // 1. Geometry update (reset / first build)
        if (pm && g.geometryRev > appliedGeometryRev.current && g.dataPoints.length === N) {
            const dummy = new THREE.Object3D();
            for (let i = 0; i < N; i++) {
                dummy.position.copy(g.dataPoints[i]);
                dummy.updateMatrix();
                pm.setMatrixAt(i, dummy.matrix);
                pm.setColorAt(i, DEFAULT_COLOR);
            }
            pm.instanceMatrix.needsUpdate = true;
            pm.computeBoundingSphere();
            if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
            appliedGeometryRev.current = g.geometryRev;
            appliedResponsibilityRev.current = g.responsibilityRev;
        }

        // 2. Responsibility color update (after E-step)
        if (pm && pm.instanceColor && g.responsibilityRev > appliedResponsibilityRev.current) {
            const c = new THREE.Color();
            for (let i = 0; i < N; i++) {
                c.setRGB(0, 0, 0);
                const r = g.responsibilities[i];
                for (let k = 0; k < K; k++) {
                    c.r += CLUSTER_COLORS[k].r * r[k];
                    c.g += CLUSTER_COLORS[k].g * r[k];
                    c.b += CLUSTER_COLORS[k].b * r[k];
                }
                c.r = Math.min(1, c.r * 1.5);
                c.g = Math.min(1, c.g * 1.5);
                c.b = Math.min(1, c.b * 1.5);
                pm.setColorAt(i, c);
            }
            pm.instanceColor.needsUpdate = true;
            appliedResponsibilityRev.current = g.responsibilityRev;
        }

        // 3. Gaussian ellipsoids (animate during M-step; diagonal covariance stays axis-aligned)
        if (g.means.length === K) {
            for (let k = 0; k < K; k++) {
                const gm = gaussianRefs.current[k];
                if (!gm) continue;

                if (g.animating) {
                    const t = g.animProgress;
                    gm.position.set(
                        g.means[k].x + (g.targetMeans[k].x - g.means[k].x) * t,
                        g.means[k].y + (g.targetMeans[k].y - g.means[k].y) * t,
                        g.means[k].z + (g.targetMeans[k].z - g.means[k].z) * t,
                    );
                    gm.scale.set(
                        Math.sqrt(g.variances[k].x + (g.targetVariances[k].x - g.variances[k].x) * t),
                        Math.sqrt(g.variances[k].y + (g.targetVariances[k].y - g.variances[k].y) * t),
                        Math.sqrt(g.variances[k].z + (g.targetVariances[k].z - g.variances[k].z) * t),
                    );
                } else {
                    gm.position.copy(g.means[k]);
                    gm.scale.set(
                        Math.sqrt(g.variances[k].x),
                        Math.sqrt(g.variances[k].y),
                        Math.sqrt(g.variances[k].z),
                    );
                }
            }
        }

        // 4. Advance animation
        if (g.animating) {
            g.animProgress += delta * ANIM_SPEED;
            if (g.animProgress >= 1) {
                g.animProgress = 1;
                for (let k = 0; k < K; k++) {
                    g.means[k].copy(g.targetMeans[k]);
                    g.variances[k].copy(g.targetVariances[k]);
                }
                g.animating = false;
                onAnimDone();
            }
        }
    });

    return (
        <>
            <color attach="background" args={['#0f172a']} />
            <fogExp2 attach="fog" args={['#0f172a', 0.015]} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 20, 10]} intensity={0.8} />

            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                maxPolarAngle={Math.PI / 1.5}
                minDistance={15}
                maxDistance={80}
            />

            <gridHelper args={[60, 30, 0x334155, 0x1e293b]} />

            <instancedMesh ref={pointMeshRef} args={[pointGeom, pointMat, N]} />

            {[0, 1, 2].map(k => (
                <mesh key={k} ref={el => { gaussianRefs.current[k] = el; }}>
                    <sphereGeometry args={[1, 32, 16]} />
                    <meshBasicMaterial color={CLUSTER_COLORS[k]} wireframe transparent opacity={0.18} />
                    <mesh>
                        <sphereGeometry args={[0.4, 16, 16]} />
                        <meshBasicMaterial color={CLUSTER_COLORS[k]} />
                    </mesh>
                </mesh>
            ))}
        </>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Stage = 'estep' | 'mstep' | 'animating';

export default function GaussianMixture() {
    const { topicId } = useParams();
    const gmmRef = useRef<GMMState>(emptyGMM());

    const [iteration, setIteration] = useState(0);
    const [logL, setLogL] = useState<number | null>(null);
    const [stage, setStage] = useState<Stage>('estep');
    const [autoRunning, setAutoRunning] = useState(false);

    // Build initial scene once
    useEffect(() => {
        rebuildGMM(gmmRef.current);
    }, []);

    const reset = useCallback(() => {
        setAutoRunning(false);
        rebuildGMM(gmmRef.current);
        setIteration(0);
        setLogL(null);
        setStage('estep');
    }, []);

    const runE = useCallback(() => {
        const g = gmmRef.current;
        if (g.animating) return;
        const ll = doEStep(g);
        setLogL(ll);
        setStage('mstep');
    }, []);

    const runM = useCallback(() => {
        const g = gmmRef.current;
        if (g.animating) return;
        doMStep(g);
        setStage('animating');
    }, []);

    const onAnimDone = useCallback(() => {
        setIteration(i => i + 1);
        setStage('estep');
    }, []);

    // Auto-run: alternates E and M with a tick interval; respects animation pause
    useEffect(() => {
        if (!autoRunning) return;
        let stepNum = 0;
        const tick = () => {
            if (gmmRef.current.animating) return;
            if (stepNum % 2 === 0) runE();
            else runM();
            stepNum++;
            if (stepNum >= 20) {
                setAutoRunning(false);
            }
        };
        const id = window.setInterval(tick, 700);
        // Kick off immediately rather than waiting 700ms
        tick();
        return () => window.clearInterval(id);
    }, [autoRunning, runE, runM]);

    // ----- UI -----
    const stageMeta = {
        estep: { color: '#60a5fa', label: 'E-Step Ready', desc: 'Compute responsibilities — color each point by P(cluster | point).' },
        mstep: { color: '#a78bfa', label: 'M-Step Ready', desc: 'Update each Gaussian — refit mean and variance to weighted points.' },
        animating: { color: '#fbbf24', label: 'Updating Distributions…', desc: 'Maximising parameters — wireframes morphing toward new fit.' },
    }[stage];

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Title */}
            <div>
                <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#a78bfa', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Bishop § 9.2
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>
                    Gaussian Mixture Models
                </h2>
                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Expectation–Maximization on 3D data
                </p>
            </div>

            {/* Equation */}
            <div style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', padding: '12px', textAlign: 'center',
            }}>
                <Latex formula="p(x) = \sum_{k=1}^{K} \pi_k\, \mathcal{N}(x \mid \mu_k, \Sigma_k)" display />
            </div>

            {/* Status card */}
            <div style={{
                background: `rgba(${stage === 'estep' ? '59,130,246' : stage === 'mstep' ? '167,139,250' : '251,191,36'}, 0.1)`,
                border: `1px solid ${stageMeta.color}55`,
                borderLeft: `3px solid ${stageMeta.color}`,
                borderRadius: '8px', padding: '12px',
            }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                    Iteration {iteration}{autoRunning ? ' · auto' : ''}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: stageMeta.color, marginBottom: '4px' }}>
                    {stageMeta.label}
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    {stageMeta.desc}
                </div>
            </div>

            {/* Log-likelihood */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid #1e293b',
                borderRadius: '10px', padding: '12px',
            }}>
                <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Log-Likelihood
                </div>
                <div style={{ color: 'white', fontFamily: 'monospace', fontWeight: 700, fontSize: '20px' }}>
                    {logL !== null ? logL.toFixed(1) : '—'}
                </div>
                <div style={{ color: '#475569', fontSize: '10px', marginTop: '3px' }}>
                    Higher = better fit
                </div>
            </div>

            {/* Step buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={runE}
                    disabled={stage !== 'estep' || autoRunning}
                    style={btnStyle(stage === 'estep' && !autoRunning ? '#3b82f6' : null)}
                >
                    1. E-Step
                </button>
                <button
                    onClick={runM}
                    disabled={stage !== 'mstep' || autoRunning}
                    style={btnStyle(stage === 'mstep' && !autoRunning ? '#8b5cf6' : null)}
                >
                    2. M-Step
                </button>
            </div>

            {/* Auto / Reset */}
            <button
                onClick={() => setAutoRunning(a => !a)}
                style={btnStyle(autoRunning ? '#ef4444' : '#10b981')}
            >
                {autoRunning ? 'Stop Auto Run' : 'Auto Run (10 iterations)'}
            </button>
            <button
                onClick={reset}
                style={{
                    padding: '8px 12px', borderRadius: '8px',
                    border: '1px solid #334155', background: '#1e293b',
                    color: '#cbd5e1', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                }}
            >
                Reset & Regenerate Data
            </button>

            {/* Legend */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid #1e293b',
                borderRadius: '10px', padding: '12px',
                fontSize: '11px', color: '#cbd5e1',
            }}>
                <b style={{ color: 'white', display: 'block', marginBottom: '8px' }}>Clusters</b>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {CLUSTER_HEX.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                width: '12px', height: '12px', borderRadius: '50%', background: c,
                                boxShadow: `0 0 8px ${c}`, flexShrink: 0,
                            }} />
                            <span>Cluster {i + 1}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* What you're seeing */}
            <div style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '10px', padding: '12px',
                fontSize: '11px', color: '#a5b4fc', lineHeight: 1.7,
            }}>
                <b style={{ color: '#818cf8', display: 'block', marginBottom: '6px' }}>What you're seeing:</b>
                <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>{N} sample points from 3 hidden gaussians</li>
                    <li>Point hue = blended responsibility γ(z<sub>nk</sub>)</li>
                    <li>Wireframe scale = 1σ ellipsoid of each fitted Gaussian</li>
                </ul>
            </div>

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic' }}>
                Drag to orbit · scroll to zoom
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <SceneCanvas dpr={[1, 1.5]} camera={{ position: [25, 20, 35], fov: 60 }} aria-label="Gaussian mixture with axis-aligned covariance ellipsoids and points colored by cluster responsibility">
                <Scene3D gmmRef={gmmRef} onAnimDone={onAnimDone} />
            </SceneCanvas>
        </SceneContainer>
    );
}

function btnStyle(active: string | null): React.CSSProperties {
    return {
        flex: 1,
        padding: '9px 12px',
        borderRadius: '8px',
        border: 'none',
        background: active ?? 'rgba(255,255,255,0.05)',
        color: active ? 'white' : '#475569',
        cursor: active ? 'pointer' : 'not-allowed',
        fontSize: '12px',
        fontWeight: 700,
        transition: 'all 0.2s',
        boxShadow: active ? `0 4px 12px ${active}55` : 'none',
    };
}
