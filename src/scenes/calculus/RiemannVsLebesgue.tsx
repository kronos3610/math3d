import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { FitSceneCamera } from '../../components/3d/FitSceneCamera';
import { HeightField } from '../../components/3d/HeightField';
import { VisualLab, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { admittedLayers, FLOOR_GRID, INTEGRATION_EXTENT, LAYER_HEIGHT, integrationFields, integrationTotals, midpointVolume, partitionVolumeCells, type IntegrationFunction, type IntegrationMode } from './riemannUtils';

interface IntegrationVisualizationProps { mode: IntegrationMode; functionType: IntegrationFunction; resolution: number; }
const CAMERA = { position: [22, 18, -22] as [number, number, number], fov: 50 };
const BOUNDS = { minimum: [-10, 0, -10] as const, maximum: [10, 9, 10] as const };

export function IntegrationVisualization({ mode, functionType, resolution }: IntegrationVisualizationProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const transform = useMemo(() => new THREE.Object3D(), []);
    const color = useMemo(() => new THREE.Color(mode === 'riemann' ? VIZ.output : VIZ.variation), [mode]);
    const boxes = useMemo(() => partitionVolumeCells(mode, integrationFields[functionType], resolution), [mode, functionType, resolution]);
    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        boxes.forEach((box, index) => {
            transform.position.set(...box.position); transform.scale.set(...box.scale); transform.updateMatrix();
            mesh.setMatrixAt(index, transform.matrix); mesh.setColorAt(index, color);
        });
        mesh.count = boxes.length; mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [boxes, transform, color]);
    // R3F owns the JSX geometry and material; all repeated cells share these resources.
    return <instancedMesh ref={meshRef} name="integration-cells" args={[undefined, undefined, boxes.length]}>
        <boxGeometry args={[1, 1, 1]} /><meshPhongMaterial transparent opacity={mode === 'riemann' ? 0.8 : 0.7} />
    </instancedMesh>;
}

function PartitionFallback({ mode, functionType, resolution }: IntegrationVisualizationProps) {
    const id = useId();
    const f = integrationFields[functionType];
    const divisions = mode === 'riemann' ? resolution : FLOOR_GRID;
    const width = INTEGRATION_EXTENT / divisions;
    const cellWidth = 390 / divisions;
    const heightStep = LAYER_HEIGHT / resolution;
    const cells = Array.from({ length: divisions ** 2 }, (_, index) => {
        const i = Math.floor(index / divisions); const j = index % divisions;
        const height = mode === 'riemann' ? f(-10 + (i + 0.5) * width, -10 + (j + 0.5) * width) : admittedLayers(f(-10 + i * width, -10 + j * width), resolution) * heightStep;
        return { i, j, height };
    });
    return <div className="spatial-fallback"><svg className="lab-chart" viewBox="0 0 800 480" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{mode === 'riemann' ? 'Midpoint column heights' : 'Lower layer heights'} over the full input floor</title>
        <desc id={`${id}-desc`}>A native top view of the same full square domain, x and y from minus ten to ten. Each square represents a floor cell; lighter squares have greater displayed height. Numerical totals use the same samples as the 3D cells.</desc>
        <text x="70" y="28" fill={VIZ.text} fontSize="22">{mode === 'riemann' ? 'Midpoint column heights' : 'Lower layer heights'}</text>
        {cells.map(({ i, j, height }, index) => <rect key={index} x={70 + i * cellWidth} y={55 + (divisions - j - 1) * cellWidth} width={cellWidth + 0.1} height={cellWidth + 0.1} fill={mode === 'riemann' ? VIZ.output : VIZ.variation} fillOpacity={0.1 + 0.9 * Math.max(0, Math.min(1, height / LAYER_HEIGHT))} />)}
        <rect x="70" y="55" width="390" height="390" fill="none" stroke={VIZ.axis} /><text x="265" y="474" textAnchor="middle" fill={VIZ.axis} fontSize="20">x: −10 … 10</text><text x="45" y="250" textAnchor="middle" transform="rotate(-90 45 250)" fill={VIZ.axis} fontSize="20">y: −10 … 10</text>
        <text x="500" y="115" fill={VIZ.text} fontSize="21">Same floor samples</text><text x="500" y="155" fill={VIZ.axis} fontSize="20">Lighter = taller</text><text x="500" y="190" fill={VIZ.axis} fontSize="20">Height: 0 … 9</text><text x="500" y="250" fill={VIZ.axis} fontSize="20">{divisions} × {divisions} floor cells</text><text x="500" y="285" fill={VIZ.axis} fontSize="20">{mode === 'lebesgue' ? `${resolution} height levels` : 'one midpoint per cell'}</text>
    </svg></div>;
}

export default function RiemannVsLebesgue() {
    const [mode, setMode] = useState<IntegrationMode>('riemann');
    const [functionType, setFunctionType] = useState<IntegrationFunction>('smooth');
    const [resolution, setResolution] = useState(12);
    const f = integrationFields[functionType];
    const reference = useMemo(() => midpointVolume(f, 200), [f]);
    const totals = useMemo(() => integrationTotals(f, resolution, reference), [f, resolution, reference]);
    const color = mode === 'riemann' ? VIZ.output : VIZ.variation;
    const controls = <>
        <LabSelect label="Slice direction" value={mode} options={[{ value: 'riemann', label: 'Riemann: vertical columns' }, { value: 'lebesgue', label: 'Lebesgue: horizontal layers' }]} onChange={value => setMode(value as IntegrationMode)} />
        <LabSelect label="Function" value={functionType} options={[{ value: 'smooth', label: 'Smooth hills' }, { value: 'spiky', label: 'Narrow peaks' }]} onChange={value => setFunctionType(value as IntegrationFunction)} />
        <LabRange label="Refinement" value={resolution} min={4} max={60} step={1} onChange={setResolution} />
    </>;
    return <VisualLab title="Same volume, different slices" subtitle="Columns group by input position; layers group by output height." backUrl="/calculus" controls={controls}
        metrics={[{ label: 'Riemann Σ', value: totals.riemann.toFixed(3) }, { label: 'Lebesgue Σ', value: totals.lebesgue.toFixed(3) }, { label: 'Fine-grid reference', value: totals.reference.toFixed(3) }, { label: 'Riemann error', value: totals.riemannError.toFixed(3) }, { label: 'Lebesgue error', value: totals.lebesgueError.toFixed(3) }]}
        legend={[{ label: 'Function', meaning: 'given height f(x,y)', color: VIZ.data, shape: 'line' }, { label: mode === 'riemann' ? 'Columns' : 'Layers', meaning: mode === 'riemann' ? 'midpoint floor samples' : 'complete admitted height levels', color, shape: 'square' }]}
        insight={mode === 'riemann' ? `${resolution}×${resolution} midpoint cells sum to ${totals.riemann.toFixed(3)}. Narrow peaks can be missed on a coarse floor grid. Errors are estimate minus reference; thin draw gaps are decorative.` : `${resolution} height layers sum to ${totals.lebesgue.toFixed(3)}. This is a lower height sum on a fixed 40×40 floor grid, not a guaranteed lower bound on the continuous integral. Refinement thins height levels only; thin draw gaps are decorative.`}
        challenge="Compare both estimates, then increase refinement. Switch to narrow peaks: does changing only the height layers recover peaks missed by the floor samples?"
        explanation={<div className="lab-explanation"><p>Riemann columns sample each floor cell at its midpoint and multiply by the full cell area. Lebesgue layers count floor samples whose heights reach each complete level. Both approximate the same integral over [−10,10]².</p><p>The layer picture samples the lower-left corner of each fixed 40×40 floor cell. Its total approaches that sampled-floor integral ({totals.sampledFloor.toFixed(3)}), rather than automatically becoming exact as height refinement increases. The reference is a 200×200 midpoint estimate, not an analytic value. Tiny render gaps separate cells; sums use full partition widths and heights. The native fallback maps the same heights over the same floor.</p></div>}>
        <SceneCanvas camera={CAMERA} frameloop="demand" aria-label={`Volume under a ${functionType} function, approximated with ${mode === 'riemann' ? 'midpoint columns' : 'horizontal lower layers'}. The selected estimate is ${(mode === 'riemann' ? totals.riemann : totals.lebesgue).toFixed(3)}.`} fallback={<PartitionFallback mode={mode} functionType={functionType} resolution={resolution} />}>
            <FitSceneCamera bounds={BOUNDS} padding={52} />
            <color attach="background" args={[VIZ.background]} /><ambientLight intensity={0.75} /><directionalLight position={[10, 25, -10]} intensity={1.2} />
            <gridHelper args={[20, 20, VIZ.muted, VIZ.grid]} />
            <HeightField f={f} extent={20} resolution={64} color={VIZ.data} wireframe opacity={0.2} />
            <IntegrationVisualization mode={mode} functionType={functionType} resolution={resolution} />
            {([{ end: [10, 0, 0], label: 'x' }, { end: [0, 9, 0], label: 'height f' }, { end: [0, 0, 10], label: 'y' }] as { end: [number, number, number]; label: string }[]).map(axis => <group key={axis.label}><Line points={[[0, 0, 0], axis.end]} color={VIZ.axis} transparent opacity={0.4} /><Html position={axis.end} center zIndexRange={[35, 0]} pointerEvents="none"><span className="spatial-axis-label">{axis.label}</span></Html></group>)}
            <OrbitControls makeDefault />
        </SceneCanvas>
    </VisualLab>;
}
