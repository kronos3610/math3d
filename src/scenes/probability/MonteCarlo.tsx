import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { FitSceneCamera } from '../../components/3d/FitSceneCamera';
import { LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { useSceneMotion } from '../../hooks/useSceneMotion';
import { VIZ } from '../../data/palette';
import { makeMonteCarloRun, monteCarloEstimate, monteCarloHistory, type MonteCarloPoint, type MonteCarloEstimate } from './monteCarloMath';

const BOUNDS = { minimum: [-1.3, -1.3, -1.3] as [number, number, number], maximum: [1.3, 1.3, 1.3] as [number, number, number] };
const CORNERS: [number, number, number][] = Array.from({ length: 8 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
const EDGES = CORNERS.flatMap((_, i) => [1, 2, 4].flatMap(bit => i < (i ^ bit) ? [[i, i ^ bit] as const] : []));

function SampleCloud({ points, count, inside }: { points: readonly MonteCarloPoint[]; count: number; inside: boolean }) {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const written = useRef(0);
    const instances = useRef(0);
    const previousPoints = useRef(points);
    const pose = useMemo(() => new THREE.Object3D(), []);
    useLayoutEffect(() => {
        const current = mesh.current;
        if (!current) return;
        if (count < written.current || points !== previousPoints.current) { written.current = 0; instances.current = 0; }
        previousPoints.current = points;
        for (let index = written.current; index < count; index++) {
            if (points[index].inside !== inside) continue;
            pose.position.set(...points[index].position); pose.updateMatrix();
            current.setMatrixAt(instances.current++, pose.matrix);
        }
        written.current = count; current.count = instances.current;
        current.instanceMatrix.needsUpdate = true;
    }, [count, points, pose, inside]);
    return <instancedMesh key={points.length} ref={mesh} args={[undefined, undefined, points.length]} count={0} frustumCulled={false}>
        {inside ? <boxGeometry args={[0.036, 0.036, 0.036]} /> : <sphereGeometry args={[0.019, 6, 4]} />}<meshBasicMaterial color={inside ? VIZ.output : VIZ.data} />
    </instancedMesh>;
}

export function MonteCarloSamples({ points, count }: { points: readonly MonteCarloPoint[]; count: number }) {
    return <><SampleCloud points={points} count={count} inside /><SampleCloud points={points} count={count} inside={false} /></>;
}

function ProjectedSamples({ points, count }: { points: readonly MonteCarloPoint[]; count: number }) {
    const id = useId();
    const project = ([x, y, z]: readonly number[]) => [200 + 65 * x + 33 * z, 145 - 65 * y - 20 * z];
    const curve = (positions: readonly (readonly number[])[]) => positions.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(',')}`).join(' ');
    const stride = Math.max(1, Math.ceil(count / 1200));
    const shown = points.slice(0, count).filter((_, index) => index % stride === 0);
    return <svg className="lab-svg-stage" viewBox="0 0 400 300" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Cube samples and unit sphere, oblique 2D projection</title>
        <desc id={`${id}-desc`}>The same three-dimensional membership tests are used in both renderers. Purple squares are inside the sphere; blue circles are outside. {count} samples contribute to the estimate. {shown.length} points are drawn, evenly selected in sample order; projection overlap does not change membership.</desc>
        {EDGES.map(([a, b], i) => <path key={i} d={curve([CORNERS[a], CORNERS[b]])} stroke={VIZ.axis} opacity="0.5" fill="none" />)}
        {[-0.7, 0, 0.7].map(y => <path key={y} d={curve(Array.from({ length: 65 }, (_, i) => { const a = i * 2 * Math.PI / 64, r = Math.sqrt(1 - y * y); return [r * Math.cos(a), y, r * Math.sin(a)]; }))} fill="none" stroke={VIZ.truth} opacity="0.6" />)}
        {[0, Math.PI / 2].map(turn => <path key={turn} d={curve(Array.from({ length: 65 }, (_, i) => { const a = i * 2 * Math.PI / 64; return [Math.cos(a) * Math.cos(turn), Math.sin(a), Math.cos(a) * Math.sin(turn)]; }))} fill="none" stroke={VIZ.truth} opacity="0.6" />)}
        {shown.map((point, i) => { const [x, y] = project(point.position); return point.inside ? <rect key={i} x={x - 2} y={y - 2} width="4" height="4" fill={VIZ.output} /> : <circle key={i} cx={x} cy={y} r="2" fill={VIZ.data} />; })}
        <text x="322" y="151" fill={VIZ.axis} fontSize="15">x</text><text x="204" y="48" fill={VIZ.axis} fontSize="15">y</text><text x="245" y="113" fill={VIZ.axis} fontSize="15">z</text>
        <text x="200" y="277" textAnchor="middle" fill={VIZ.axis} fontSize="13">Radius 1 · cube side 2 · {count > shown.length ? `${shown.length} of ${count} points drawn` : `${count} points drawn`}</text>
    </svg>;
}

function ErrorHistory({ history, budget }: { history: readonly MonteCarloEstimate[]; budget: number }) {
    const id = useId(), left = 70, right = 380, top = 25, bottom = 235;
    const x = (n: number) => left + Math.log10(n) / Math.log10(budget) * (right - left);
    const y = (error: number) => bottom - (Math.log10(Math.max(0.0001, error)) + 4) / 5 * (bottom - top);
    const path = (field: 'error' | 'standardError') => history.map((p, i) => `${i ? 'L' : 'M'}${x(p.total)},${y(p[field])}`).join(' ');
    return <svg className="lab-svg-stage" viewBox="0 0 400 300" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Absolute estimation error versus sample count</title>
        <desc id={`${id}-desc`}>Both axes are logarithmic. Solid pink is the actual absolute error for this seed. Dashed lavender is the theoretical one-standard-error scale, 6 times square root of p(1−p)/n with p=π/6. It is a typical scale, not a guaranteed bound; a single run can move up or cross it.</desc>
        {[10, 1, 0.1, 0.01, 0.001, 0.0001].map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={VIZ.axis} opacity="0.18" /><text x={left - 8} y={y(value) + 4} textAnchor="end" fontSize="12" fill={VIZ.axis}>{value}</text></g>)}
        {[1, 10, 100, 1000, 10000].filter(n => n <= budget).map(n => <g key={n}><line x1={x(n)} x2={x(n)} y1={top} y2={bottom} stroke={VIZ.axis} opacity="0.18" /><text x={x(n)} y={bottom + 18} fontSize="12" textAnchor="middle" fill={VIZ.axis}>{n}</text></g>)}
        <path d={path('standardError')} fill="none" stroke={VIZ.variation} strokeWidth="2" strokeDasharray="6 4" /><path d={path('error')} fill="none" stroke={VIZ.error} strokeWidth="2" />
        {history.length > 0 && <circle cx={x(history.at(-1)!.total)} cy={y(history.at(-1)!.error)} r="4" fill={VIZ.focus} />}
        <text x="225" y="278" textAnchor="middle" fontSize="14" fill={VIZ.axis}>Samples n · log scale</text><text x="16" y="140" textAnchor="middle" transform="rotate(-90 16 140)" fontSize="14" fill={VIZ.axis}>|π̂ − π| · log scale</text>
    </svg>;
}

export default function MonteCarlo() {
    const [seed, setSeed] = useState(7), [budget, setBudget] = useState(500), [count, setCount] = useState(50), [playing, setPlaying] = useState(false);
    const moving = useSceneMotion(), active = playing && moving && count < budget;
    const run = useMemo(() => makeMonteCarloRun(seed, budget), [seed, budget]);
    const stats = monteCarloEstimate(run, count);
    const history = useMemo(() => monteCarloHistory(run, count), [run, count]);
    const batch = Math.max(1, Math.ceil(budget / 80));
    useEffect(() => { if (!active) return; const timer = window.setTimeout(() => setCount(n => Math.min(budget, n + batch)), 125); return () => window.clearTimeout(timer); }, [active, budget, batch, count]);
    const restart = (newSeed = false) => { setPlaying(false); setCount(0); if (newSeed) setSeed(s => s + 1); };
    const legend = [
        { label: 'Sphere', meaning: 'unit-radius target region', color: VIZ.truth, shape: 'line' as const },
        { label: 'Inside', meaning: 'squares / cubes counted in π̂', color: VIZ.output, shape: 'square' as const },
        { label: 'Outside', meaning: 'circles / spheres, not counted', color: VIZ.data, shape: 'dot' as const },
        { label: 'Error', meaning: 'actual |π̂ − π|, solid', color: VIZ.error, shape: 'line' as const },
        { label: '1/√n', meaning: 'typical error scale, dashed', color: VIZ.variation, shape: 'line' as const },
    ];
    return <VisualLab backUrl="/probability" title="Monte Carlo: estimate π" subtitle={`Scatter points in a cube; count those inside the sphere. Reproducible seed ${seed}.`}
        legend={legend} metrics={[{ label: 'Samples', value: `${stats.total}/${budget}` }, { label: 'Inside sphere', value: stats.inside }, { label: 'π estimate', value: count ? stats.estimate.toFixed(4) : '—' }, { label: 'Absolute error', value: count ? stats.error.toFixed(4) : '—' }]}
        controls={<><LabSelect label="Sample budget" value={String(budget)} options={[100, 500, 2000, 10000].map(n => ({ value: String(n), label: n.toLocaleString() }))} onChange={value => { setBudget(Number(value)); restart(); }} />
            <LabRange label="Samples revealed" value={count} min={0} max={budget} onChange={value => { setPlaying(false); setCount(value); }} />
            <div className="visual-lab-playback"><button className="lab-button" type="button" disabled={count >= budget} onClick={() => { setPlaying(false); setCount(n => Math.min(budget, n + batch)); }}>Add {batch} samples</button>
                <button className="lab-button" type="button" aria-pressed={active} disabled={!moving} onClick={() => { if (active) setPlaying(false); else { if (count >= budget) setCount(0); setPlaying(true); } }}>{active ? 'Pause' : 'Play'}</button>
                <button className="lab-button" type="button" onClick={() => restart()}>Restart same seed</button><button className="lab-button" type="button" onClick={() => restart(true)}>Run again: new seed</button>{!moving && <span>Motion paused · manual samples still work</span>}</div></>}
        insight={count ? `π̂ = 6 × ${stats.inside}/${count} = ${stats.estimate.toFixed(4)}. The error fluctuates; 100× more independent samples gives about 10× smaller typical error, not a guarantee for this run.` : 'Reveal samples or press Play. Restart repeats the same sequence; Run again changes the seed.'}
        challenge="Before increasing the sample budget, predict whether every added point must improve the estimate. Compare two seeds on the error plot."
        explanation={<div className="lab-explanation"><h2>Why the count estimates π</h2><p>The unit sphere has volume 4π/3 and the cube has volume 8. Uniform independent samples fall inside with probability π/6, so multiplying the inside fraction by six estimates π.</p><p>The second plot compares actual error with 6√(p(1−p)/n), using p=π/6. This theoretical standard error falls as 1/√n; it is not a confidence bound. One sequence can improve, worsen, or cross the dashed line. Errors below 0.0001 are displayed at the plot floor.</p><p>Every sample contributes to the count. The static projection draws at most 1,200 evenly selected points for readability; its overlapping positions do not replace the three-dimensional membership test. A seeded pseudorandom sequence makes runs reproducible; it is a simulation, not a proof of π.</p></div>}>
        <div className="lab-split-stage"><div><SceneCanvas camera={{ position: [3, 2.3, 3], fov: 45 }} aria-label={`${count} uniformly sampled cube points; ${stats.inside} purple cubes lie inside the unit sphere and count toward π; blue spheres are outside.`} fallback={<ProjectedSamples points={run.points} count={count} />}>
            <color attach="background" args={[VIZ.background]} /><mesh><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color={VIZ.truth} wireframe transparent opacity={0.25} /></mesh>
            {EDGES.map(([a, b], i) => <Line key={i} points={[CORNERS[a], CORNERS[b]]} color={VIZ.axis} transparent opacity={0.5} />)}
            {(['x', 'y', 'z'] as const).map((axis, i) => { const point: [number, number, number] = [0, 0, 0]; point[i] = 1.2; return <Html center key={axis} position={point}><div className="spatial-point-label">{axis}</div></Html>; })}
            <MonteCarloSamples key={`${seed}-${budget}`} points={run.points} count={count} /><OrbitControls makeDefault enableDamping /><FitSceneCamera bounds={BOUNDS} padding={25} />
        </SceneCanvas></div><ErrorHistory history={history} budget={budget} /></div>
    </VisualLab>;
}
