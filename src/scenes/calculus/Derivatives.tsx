import { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneFrame as useFrame } from '../../hooks/useSceneFrame';
import { useSceneMotion } from '../../hooks/useSceneMotion';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { HeightField } from '../../components/3d/HeightField';
import { sampleHeightField } from '../../components/3d/height-field-geometry';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VIZ } from '../../data/palette';
import { derivativeFunction, derivativeSlice } from './legacyCalculusMath';

/** No point prop preserves the original animated export and its local tangent frame. */
export function DerivativeSurface({ point }: { point?: { x: number; y: number } } = {}) {
    const tangentRef = useRef<THREE.Group>(null);
    const x = point?.x ?? 0; const localY = point ? -point.y : 2;
    useFrame(state => {
        if (point || !tangentRef.current) return;
        const t = state.clock.elapsedTime * 0.3;
        const nextX = Math.sin(t) * 2; const nextY = Math.cos(t) * 2;
        tangentRef.current.position.set(nextX, nextY, derivativeFunction(nextX, nextY));
        tangentRef.current.rotation.y = -Math.atan(0.8 * Math.cos(nextX) * Math.cos(nextY));
    });
    return <>
        <HeightField f={derivativeFunction} extent={6} color={VIZ.data} opacity={0.45} />
        <group rotation={[-Math.PI / 2, 0, 0]}>
            <group ref={tangentRef} name="derivative-tangent" position={[x, localY, derivativeFunction(x, localY)]} rotation={[0, -Math.atan(0.8 * Math.cos(x) * Math.cos(localY)), 0]}>
                <mesh><sphereGeometry args={[0.08, 16, 16]} /><meshBasicMaterial color={VIZ.focus} /></mesh>
                <Line points={[[-0.8, 0, 0], [0.8, 0, 0]]} color={VIZ.truth} lineWidth={3} />
            </group>
        </group>
    </>;
}

const surface = { ...sampleHeightField(derivativeFunction, 8, 48), color: VIZ.data, opacity: 0.14 };

export default function Derivatives() {
    const [pointX, setPointX] = useState(0.8);
    const [sliceY, setSliceY] = useState(0.6);
    const [h, setH] = useState(1);
    const [automatic, setAutomatic] = useState(false);
    const [phase, setPhase] = useState(0);
    const moving = useSceneMotion();
    useEffect(() => {
        if (!automatic || !moving) return;
        const timer = window.setInterval(() => setPhase(value => value + 0.03), 80);
        return () => window.clearInterval(timer);
    }, [automatic, moving]);
    const x = automatic ? 2 * Math.sin(phase) : pointX;
    const y = automatic ? 2 * Math.cos(phase) : sliceY;
    const values = derivativeSlice(x, y, h);
    const curve = useMemo(() => Array.from({ length: 129 }, (_, index): LabVector => {
        const coordinate = -4 + index / 16;
        return [coordinate, derivativeFunction(coordinate, y), y];
    }), [y]);
    const tangent: LabVector[] = [-0.8, 0.8].map(offset => [x + offset, values.value + offset * values.tangent, y]);
    const secant: LabVector[] = [-0.2, h + 0.2].map(offset => [x + offset, values.value + offset * values.secant, y]);
    const controls = <>
        <LabRange label="Point x" value={x} min={-2.5} max={2.5} step={0.05} decimals={2} onChange={value => { setAutomatic(false); setPointX(value); setSliceY(y); }} />
        <LabRange label="Slice y" value={y} min={-2.5} max={2.5} step={0.05} decimals={2} onChange={value => { setAutomatic(false); setSliceY(value); setPointX(x); }} />
        <LabRange label="Secant step h" value={h} min={0.01} max={1.5} step={0.01} decimals={2} onChange={setH} />
        <label className="lab-checkbox"><input type="checkbox" checked={automatic} onChange={event => { if (!event.target.checked) { setPointX(x); setSliceY(y); } setAutomatic(event.target.checked); }} />Trace automatically</label>
    </>;
    return <VisualLab title="Derivative of a slice" subtitle="Fix one input, then bring the second secant point toward the first." backUrl="/calculus" controls={controls}
        metrics={[{ label: 'Secant slope', value: values.secant.toFixed(4) }, { label: 'Tangent slope ∂f/∂x', value: values.tangent.toFixed(4) }, { label: 'Slope difference', value: values.difference.toFixed(4) }]}
        legend={[{ label: 'Curve', meaning: 'f(x,y) at the chosen slice y', color: VIZ.data, shape: 'line' }, { label: 'Slice', meaning: 'vertical plane with y fixed', color: VIZ.variation, shape: 'square' }, { label: 'Point', meaning: 'the x input being inspected', color: VIZ.focus }, { label: 'Secant', meaning: 'average slope across h', color: VIZ.output, shape: 'line' }, { label: 'Tangent', meaning: 'instantaneous x slope', color: VIZ.truth, shape: 'line' }]}
        insight={`On slice y=${y.toFixed(2)}, the secant uses x=${x.toFixed(2)} and x+h=${(x + h).toFixed(2)}. Its slope differs from the tangent by ${Math.abs(values.difference).toFixed(4)}.${automatic && !moving ? ' Automatic motion is paused; manual inputs still work.' : ''}`}
        challenge="Shrink h toward 0.01 without moving the point. Watch the two slopes meet; then move the slice to change the curve."
        explanation={<div className="lab-explanation"><p>The surface is f(x,y)=0.8 sin(x) cos(y). Holding y fixed cuts out a one-dimensional curve. The secant slope is [f(x+h,y)−f(x,y)]/h. As h tends to zero it approaches ∂f/∂x=0.8 cos(x) cos(y), the tangent slope.</p><p>The floor axes are the two inputs; vertical height is f. This lesson follows one slice. Partial Derivatives compares both input directions and the gradient. Automatic tracing is optional and respects Pause motion.</p></div>}>
        <SpatialScene surfaces={[surface]} boxes={[{ position: [0, 0, y], size: [8, 2.4, 0.006], color: VIZ.variation, opacity: 0.12 }]} paths={[{ points: curve, color: VIZ.data, width: 4 }, { points: tangent, color: VIZ.truth, width: 4 }, { points: secant, color: VIZ.output, width: 3, dashed: true }]}
            points={[{ position: [x, values.value, y], color: VIZ.focus, radius: 0.1, label: 'x' }, { position: [x + h, values.nextValue, y], color: VIZ.output, radius: 0.07, label: 'x+h' }]}
            axes={['input x', 'height f(x,y)', 'fixed input y']} description={`Surface with fixed slice y=${y.toFixed(2)}, a secant of slope ${values.secant.toFixed(4)} and tangent of slope ${values.tangent.toFixed(4)} at x=${x.toFixed(2)}. Move h to compare average and instantaneous slopes.`} />
    </VisualLab>;
}
