import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useParams } from 'react-router-dom';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { VisualLab, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { ellipsoidGridCover, ELLIPSOID_AXES, ELLIPSOID_VOLUME, type CoverCell } from './ellipsoidCover';

function CoverBoxes({ cells }: { cells: readonly CoverCell[] }) {
    const mesh = useRef<THREE.InstancedMesh>(null);
    useLayoutEffect(() => {
        if (!mesh.current) return;
        const pose = new THREE.Matrix4();
        cells.forEach((cell, index) => { pose.makeScale(cell.size, cell.size, cell.size); pose.setPosition(...cell.position); mesh.current!.setMatrixAt(index, pose); });
        mesh.current.instanceMatrix.needsUpdate = true; mesh.current.computeBoundingSphere();
    }, [cells]);
    return <instancedMesh key={cells.length} ref={mesh} args={[undefined, undefined, cells.length]}><boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={VIZ.output} wireframe transparent opacity={0.18} depthWrite={false} /></instancedMesh>;
}
function MeasureFallback({ step, dimension, thickness, cells }: { step: number; dimension: number; thickness: number; cells: readonly CoverCell[] }) {
    const section = cells.filter(cell => Math.abs(cell.position[1]) <= cell.size / 2 + 1e-9 && cell.position[1] >= 0);
    return <figure className="spatial-fallback"><svg viewBox="0 0 640 400" role="img" aria-label={step === 1 ? 'Central section of the computed 3D ellipsoid cover' : step === 2 ? 'Area square and its covering slab thickness' : 'Length, area, or volume of a rectangular box'}>
        {step === 1 ? <><ellipse cx="320" cy="190" rx={ELLIPSOID_AXES[0] * 70} ry={ELLIPSOID_AXES[2] * 70} fill={VIZ.truth} opacity="0.3" />
            {section.map((cell, index) => <rect key={index} x={320 + (cell.position[0] - cell.size / 2) * 70} y={190 + (cell.position[2] - cell.size / 2) * 70}
                width={cell.size * 70} height={cell.size * 70} fill={VIZ.output} fillOpacity="0.18" stroke={VIZ.output} strokeOpacity="0.6" strokeWidth="0.75" />)}
            <text x="320" y="330" textAnchor="middle" fill={VIZ.muted}>Central y = 0 section · total readout uses all 3D cells</text></>
            : step === 2 ? <><path d="M180 230 L350 280 L460 180 L290 130 Z" fill={VIZ.truth} opacity="0.45" />
                <path d={`M180 ${230-thickness*45} L350 ${280-thickness*45} L460 ${180-thickness*45} L290 ${130-thickness*45} Z L290 ${130+thickness*45} L460 ${180+thickness*45} L350 ${280+thickness*45} L180 ${230+thickness*45} Z`} fill={VIZ.output} opacity="0.25" stroke={VIZ.output} />
                <text x="320" y="335" textAnchor="middle" fill={VIZ.muted}>Area = 16 · covering volume = 16ε</text></>
            : <><path d={dimension === 1 ? 'M220 235 L420 235' : dimension === 2 ? 'M220 235 L420 235 L420 85 L220 85 Z' : 'M220 235 L420 235 L420 85 L220 85 Z M220 85 L285 40 L485 40 L420 85 M485 40 L485 190 L420 235'}
                fill={dimension === 1 ? 'none' : VIZ.truth} fillOpacity="0.2" stroke={VIZ.truth} strokeWidth="3" />
                <text x="320" y="280" textAnchor="middle" fill={VIZ.muted}>Δx = 2{dimension >= 2 ? ' · Δy = 1.5' : ''}{dimension >= 3 ? ' · Δz = 1' : ''}</text></>}
    </svg><figcaption>{step === 1 ? '2D section of the same guaranteed 3D cover' : '2D diagram of the same dimensions and covering volume'}</figcaption></figure>;
}

export default function LebesgueMeasure() {
    const { topicId } = useParams();
    const [activeStep, setActiveStep] = useState(0);
    const [dimension, setDimension] = useState(3);
    const [resolution, setResolution] = useState(0);
    const [coverThickness, setCoverThickness] = useState(0);
    const thickness = [0.8, 0.4, 0.15, 0.04][coverThickness];
    const cells = useMemo(() => ellipsoidGridCover([4, 8, 16, 32][resolution]), [resolution]);
    const coverVolume = cells.reduce((sum, cell) => sum + cell.size ** 3, 0);
    const measure = dimension === 1 ? 2 : dimension === 2 ? 3 : 3;
    return <VisualLab title="Lebesgue measure" subtitle="Build size from boxes, then refine a cover or squeeze a set's covering volume toward zero."
        backUrl={`/${topicId || 'calculus'}`} metrics={activeStep === 0 ? [{ label: dimension === 1 ? 'Length' : dimension === 2 ? 'Area' : 'Volume', value: measure }, { label: 'Active dimensions', value: dimension }]
            : activeStep === 1 ? [{ label: 'Guaranteed covering volume', value: coverVolume.toFixed(3) }, { label: 'Exact solid volume', value: ELLIPSOID_VOLUME.toFixed(3) }, { label: 'Excess volume', value: (coverVolume - ELLIPSOID_VOLUME).toFixed(3) }, { label: 'Cells', value: cells.length }]
            : [{ label: 'Square area', value: 16 }, { label: 'Thickness ε', value: thickness.toFixed(2) }, { label: 'Covering volume', value: (16 * thickness).toFixed(2) }]}
        legend={activeStep === 0 ? [{ label: 'Box', meaning: 'set being measured', color: VIZ.truth, shape: 'square' }] : [{ label: 'Given set', meaning: activeStep === 1 ? 'ellipsoid solid' : 'zero-thickness square', color: VIZ.truth, shape: 'square' },
            { label: 'Boxes / slab', meaning: 'computed covering output', color: VIZ.output, shape: 'square' }]}
        controls={<><LabSelect label="Measure experiment" value={String(activeStep)} options={[{ value: '0', label: 'Building Blocks' }, { value: '1', label: 'Outer Measure' }, { value: '2', label: 'Null Sets' }]} onChange={value => setActiveStep(Number(value))} />
            {activeStep === 0 ? <LabRange label="Dimension" value={dimension} min={1} max={3} onChange={setDimension} />
                : activeStep === 1 ? <LabRange label="Box Resolution" value={resolution} min={0} max={3} onChange={setResolution} />
                : <LabRange label="Cover Thickness" value={coverThickness} min={0} max={3} onChange={setCoverThickness} />}</>}
        insight={activeStep === 0 ? `Multiply the active side lengths: ${dimension === 1 ? '2' : dimension === 2 ? '2 × 1.5 = 3' : '2 × 1.5 × 1 = 3'}. Units change from length to area to volume.`
            : activeStep === 1 ? `All ${cells.length} displayed cells intersect the solid and cover it completely. Their volume exceeds the solid by ${(coverVolume - ELLIPSOID_VOLUME).toFixed(3)}; refinement reduces this excess.`
            : `The square's area stays 16 while the slab volume is 16 × ${thickness.toFixed(2)} = ${(16 * thickness).toFixed(2)}. Let ε approach zero to show zero 3D measure.`}
        challenge="Open Null Sets and make the cover thin. How can the square keep positive area while its 3D volume is zero?"
        explanation={<div className="lab-explanation"><p>Lebesgue measure generalizes length, area, and volume. Boxes have measure equal to the product of their side lengths. Translation preserves size and disjoint measurable pieces add.</p>
            <p>The ellipsoid has semiaxes 1.6, 0.9, 1.2. The existing exact intersection test selects a guaranteed finite grid cover; outer measure is the infimum over all appropriate countable covers, not this one cover's sum.</p>
            <p>A bounded 2D square in 3D can be covered by a slab with arbitrarily small volume. The drawn thickness is positive; the limit is zero. The same reasoning for an unbounded plane requires countably many covers. The WebGL-free diagram shows a central section of the same computed 3D cover, while metrics sum all cells.</p></div>}>
        <SceneCanvas frameloop="demand" camera={{ position: [5, 4, 5], fov: 45 }} aria-label="Box dimensions, a guaranteed ellipsoid cover, or a shrinking slab over a square"
            fallback={<MeasureFallback step={activeStep} dimension={dimension} thickness={thickness} cells={cells} />}>
            <color attach="background" args={[VIZ.background]} /><ambientLight intensity={0.7} /><directionalLight position={[5, 8, 5]} intensity={1} />
            {activeStep === 0 ? dimension === 1 ? <mesh><boxGeometry args={[2, 0.025, 0.025]} /><meshLambertMaterial color={VIZ.truth} /></mesh>
                : <mesh><boxGeometry args={[2, 1.5, dimension === 2 ? 0.025 : 1]} /><meshLambertMaterial color={VIZ.truth} transparent opacity={0.4} /></mesh>
                : activeStep === 1 ? <><mesh scale={[...ELLIPSOID_AXES]}><sphereGeometry args={[1, 40, 24]} /><meshLambertMaterial color={VIZ.truth} transparent opacity={0.5} /></mesh><CoverBoxes cells={cells} /></>
                : <><mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4, 4]} /><meshLambertMaterial color={VIZ.truth} side={THREE.DoubleSide} transparent opacity={0.5} /></mesh>
                    <mesh><boxGeometry args={[4, thickness, 4]} /><meshLambertMaterial color={VIZ.output} transparent opacity={0.25} depthWrite={false} /></mesh></>}
            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </SceneCanvas>
    </VisualLab>;
}
