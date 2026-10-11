import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { FitSceneCamera } from '../../components/3d/FitSceneCamera';
import { LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { boundaryAccuracy, boundaryNormal, boundaryPlanePolygon, boundaryPrediction, makeBoundaryDataset, type BoundaryDataset, type BoundaryKind, type BoundaryParameters, type BoundaryPoint, type BoundaryVector } from './decisionBoundaryMath';

const DEFAULT_NORMAL: BoundaryVector = [1.5, 1, 0];
const BOUNDS = { minimum: [-3.5, -3.5, -3.5] as BoundaryVector, maximum: [3.5, 3.5, 3.5] as BoundaryVector };

/** Preserve the historical fixed example for geometry consumers and its regression test. */
export function DecisionPlane({ normal = DEFAULT_NORMAL, offset = 0 }: { normal?: BoundaryVector; offset?: number } = {}) {
    const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal).normalize()), [normal]);
    const position = useMemo(() => new THREE.Vector3(...normal).normalize().multiplyScalar(offset).toArray(), [normal, offset]);
    return <mesh quaternion={quaternion.toArray()} position={position}><planeGeometry args={[8, 8]} /><meshStandardMaterial color={VIZ.focus} transparent opacity={0.1} side={THREE.DoubleSide} /></mesh>;
}

function ClassPoints({ points, classId }: { points: readonly BoundaryPoint[]; classId: 0 | 1 }) {
    const ref = useRef<THREE.InstancedMesh>(null);
    const selected = useMemo(() => points.filter(point => point.classId === classId), [points, classId]);
    useLayoutEffect(() => {
        if (!ref.current) return;
        const matrix = new THREE.Matrix4();
        selected.forEach((point, index) => ref.current!.setMatrixAt(index, matrix.makeTranslation(...point.position)));
        ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere();
    }, [selected]);
    return <instancedMesh key={selected.length} ref={ref} args={[undefined, undefined, selected.length]}>
        {classId === 0 ? <sphereGeometry args={[0.075, 8, 6]} /> : <boxGeometry args={[0.12, 0.12, 0.12]} />}<meshBasicMaterial color={VIZ.data} />
    </instancedMesh>;
}

function PlanePatch({ polygon }: { polygon: readonly BoundaryVector[] }) {
    const geometry = useMemo(() => {
        const coordinates: number[] = [];
        for (let index = 1; index < polygon.length - 1; index++) coordinates.push(...polygon[0], ...polygon[index], ...polygon[index + 1]);
        const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3)); result.computeVertexNormals(); return result;
    }, [polygon]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return polygon.length < 3 ? null : <><mesh geometry={geometry}><meshBasicMaterial color={VIZ.focus} side={THREE.DoubleSide} transparent opacity={0.16} depthWrite={false} /></mesh><Line points={[...polygon, polygon[0]]} color={VIZ.focus} lineWidth={2} /></>;
}

function BoundaryProjection({ points, parameters, mistakes, polygon }: { points: readonly BoundaryPoint[]; parameters: BoundaryParameters; mistakes: readonly number[]; polygon: readonly BoundaryVector[] }) {
    const id = useId(), wrong = new Set(mistakes);
    const project = ([x, y, z]: BoundaryVector) => [200 + 37 * x + 19 * z, 150 - 37 * y - 12 * z];
    const path = (positions: readonly BoundaryVector[]) => positions.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(',')}`).join(' ');
    const sphereCurves = Array.from({ length: 5 }, (_, ring) => {
        const latitude = (ring - 2) * Math.PI / 6, height = parameters.radius * Math.sin(latitude), radius = parameters.radius * Math.cos(latitude);
        return Array.from({ length: 65 }, (_, i) => [radius * Math.cos(i * 2 * Math.PI / 64), height, radius * Math.sin(i * 2 * Math.PI / 64)] as BoundaryVector);
    });
    return <svg className="lab-svg-stage" viewBox="0 0 400 320" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Three-feature decision boundary, oblique 2D projection</title>
        <desc id={`${id}-desc`}>Circles are given class 0; squares are given class 1. Pink rings indicate {mistakes.length} wrong predictions. Gold is the current {parameters.kind}. All predictions use original three-dimensional coordinates; overlapping projected points do not change the count.</desc>
        {([0, 1, 2] as const).map(axis => { const start: BoundaryVector = [0, 0, 0], end: BoundaryVector = [0, 0, 0]; start[axis] = -3; end[axis] = 3; const [x, y] = project(end); return <g key={axis}><path d={path([start, end])} fill="none" stroke={VIZ.axis} opacity="0.55" /><text x={x + 7} y={y - 5} fontSize="14" fill={VIZ.axis}>x{axis + 1}</text></g>; })}
        {parameters.kind === 'plane' ? <path d={path(polygon) + ' Z'} fill={VIZ.focus} fillOpacity="0.12" stroke={VIZ.focus} strokeWidth="2" /> : sphereCurves.map((positions, i) => <path key={i} d={path(positions)} fill="none" stroke={VIZ.focus} strokeWidth="1.5" opacity="0.7" />)}
        {points.map((point, index) => { const [x, y] = project(point.position); return <g key={index}><title>Class {point.classId}; predicted {boundaryPrediction(point.position, parameters)}{wrong.has(index) ? '; wrong' : '; correct'}</title>{wrong.has(index) && <circle cx={x} cy={y} r="7" fill="none" stroke={VIZ.error} strokeWidth="2" />}{point.classId === 0 ? <circle cx={x} cy={y} r="3" fill={VIZ.data} /> : <rect x={x - 3} y={y - 3} width="6" height="6" fill={VIZ.data} />}</g>; })}
        <text x="200" y="302" fontSize="13" fill={VIZ.axis} textAnchor="middle">Oblique projection · predictions use all 3 features</text>
    </svg>;
}

export default function DecisionBoundaries() {
    const [dataset, setDataset] = useState<BoundaryDataset>('separable'), [kind, setKind] = useState<BoundaryKind>('plane');
    const [tilt, setTilt] = useState(0), [turn, setTurn] = useState(70), [offset, setOffset] = useState(0.45), [radius, setRadius] = useState(1.2), [seed, setSeed] = useState(31);
    const points = useMemo(() => makeBoundaryDataset(dataset, seed), [dataset, seed]);
    const parameters = useMemo(() => ({ kind, tilt, turn, offset, radius }), [kind, tilt, turn, offset, radius]);
    const result = useMemo(() => boundaryAccuracy(points, parameters), [points, parameters]);
    const normal = useMemo(() => boundaryNormal(tilt, turn), [tilt, turn]);
    const polygon = useMemo(() => boundaryPlanePolygon(normal, offset), [normal, offset]);
    const rule = kind === 'plane' ? `Class 1 when ${normal.map((value, i) => `${value.toFixed(2)}x${i + 1}`).join(' + ')} ≥ ${offset.toFixed(2)}.` : `Class 1 inside radius ${radius.toFixed(2)}; class 0 outside.`;
    return <VisualLab backUrl="/ml" title="Move a decision boundary" subtitle={`Change the separator; count mistakes on the same seeded points. Seed ${seed}.`}
        legend={[{ label: 'Class 0', meaning: 'given label; circles / spheres', color: VIZ.data, shape: 'dot' }, { label: 'Class 1', meaning: 'given label; squares / cubes', color: VIZ.data, shape: 'square' }, { label: 'Boundary', meaning: 'current prediction rule', color: VIZ.focus, shape: 'line' }, { label: 'Wrong', meaning: 'prediction disagrees; ring', color: VIZ.error, shape: 'line' }]}
        metrics={[{ label: 'Accuracy', value: `${(100 * result.accuracy).toFixed(1)}%` }, { label: 'Misclassified', value: `${result.mistakes.length}/${points.length}` }, { label: 'Correct', value: result.correct }]}
        controls={<><LabSelect label="Dataset" value={dataset} options={[{ value: 'separable', label: 'Separable blobs' }, { value: 'overlap', label: 'Overlapping blobs' }, { value: 'xor', label: 'XOR-like quadrants' }, { value: 'shells', label: 'Concentric shells' }]} onChange={value => setDataset(value as BoundaryDataset)} />
            <LabSelect label="Boundary" value={kind} options={[{ value: 'plane', label: 'Plane: linear separator' }, { value: 'sphere', label: 'Sphere: curved separator' }]} onChange={value => setKind(value as BoundaryKind)} />
            {kind === 'plane' ? <><LabRange label="Plane tilt" value={tilt} min={-80} max={80} step={5} onChange={setTilt} /><LabRange label="Plane turn" value={turn} min={-180} max={180} step={5} onChange={setTurn} /><LabRange label="Plane offset" value={offset} min={-2.5} max={2.5} step={0.05} decimals={2} onChange={setOffset} /></> : <LabRange label="Sphere radius" value={radius} min={0.2} max={3} step={0.05} decimals={2} onChange={setRadius} />}
            <button type="button" className="lab-button" onClick={() => setSeed(s => s + 1)}>Resample points</button><button type="button" className="lab-button" onClick={() => { setTilt(0); setTurn(70); setOffset(0.45); setRadius(1.2); }}>Reset boundary</button></>}
        insight={`${rule} Pink rings mark all ${result.mistakes.length} mistakes. ${dataset === 'xor' ? 'Alternating quadrant labels expose the limits of one plane; a centered sphere is not a general XOR solution either.' : dataset === 'shells' ? 'A sphere can separate an inner group from an outer shell; a single plane cannot enclose the inner group.' : 'Move the gold boundary and watch predictions change while the given labels stay fixed.'}`}
        challenge="Try to eliminate the mistakes on XOR-like data with a plane. Then choose Concentric shells and compare a plane with a sphere."
        explanation={<div className="lab-explanation"><h2>A boundary is a rule</h2><p>The plane predicts class 1 when n·x≥offset. Tilt and turn rotate the unit normal n; offset is signed distance from the origin. The gold patch is the plane clipped to the displayed cube [−3,3]³, not a fitted surface. The sphere predicts class 1 when x₁²+x₂²+x₃²≤radius².</p><p>Circles/spheres and squares/cubes carry the original class labels. A pink ring means the current prediction differs from that label; every original point contributes to the accuracy. The static SVG projects all three coordinates and applies the same three-dimensional rule.</p><p>The XOR-like set has alternating quadrant labels and demonstrates the limits of a single linear separator. A centered sphere is a different family, not a universal nonlinear classifier or an XOR solver. Concentric shells supply a problem that matches the sphere family. Overlapping labels can remain imperfect even with a reasonable separator.</p><p>These are seeded synthetic data and manually chosen boundaries; this lab does not train a classifier or report held-out generalization. Use Linear Models for Classification to fit an editable dataset.</p></div>}>
        <SceneCanvas camera={{ position: [7, 5, 7], fov: 45 }} aria-label={`Three-feature labeled data and a movable ${kind} boundary. Class 0 points are spheres; class 1 points are cubes. ${result.mistakes.length} misclassified points have pink rings.`} fallback={<BoundaryProjection points={points} parameters={parameters} mistakes={result.mistakes} polygon={polygon} />}>
            <color attach="background" args={[VIZ.background]} /><ClassPoints points={points} classId={0} /><ClassPoints points={points} classId={1} />
            {kind === 'plane' ? <PlanePatch polygon={polygon} /> : <mesh><sphereGeometry args={[radius, 24, 16]} /><meshBasicMaterial color={VIZ.focus} wireframe transparent opacity={0.32} /></mesh>}
            {result.mistakes.map(index => <mesh key={index} position={points[index].position}><torusGeometry args={[0.13, 0.018, 6, 16]} /><meshBasicMaterial color={VIZ.error} /></mesh>)}
            {([0, 1, 2] as const).map(axis => { const start: BoundaryVector = [0, 0, 0], end: BoundaryVector = [0, 0, 0]; start[axis] = -3; end[axis] = 3; return <group key={axis}><Line points={[start, end]} color={VIZ.axis} transparent opacity={0.4} /><Html center position={end}><div className="spatial-point-label">x{axis + 1}</div></Html></group>; })}
            <OrbitControls makeDefault enableDamping /><FitSceneCamera bounds={BOUNDS} padding={35} />
        </SceneCanvas>
    </VisualLab>;
}
