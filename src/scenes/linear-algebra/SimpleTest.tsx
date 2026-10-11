import { VIZ } from '../../data/palette';
import { useMemo, useState } from 'react';
import { SpatialScene, type SpatialPath } from '../../components/3d/SpatialScene';
import { LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import type { Vector3Tuple } from './legacyLinearMath';

const CORNERS: Vector3Tuple[] = Array.from({ length: 8 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
const EDGES: SpatialPath[] = CORNERS.flatMap((_, i) => [1, 2, 4].flatMap(bit => i < (i ^ bit) ? [{ points: [CORNERS[i], CORNERS[i ^ bit]], color: VIZ.data }] : []));

export default function SimpleTest() {
    const [corner, setCorner] = useState(7);
    const point = CORNERS[corner];
    const scene = useMemo(() => ({ paths: EDGES, points: [{ position: CORNERS[corner], color: VIZ.focus, label: `Selected (${CORNERS[corner].join(', ')})` }], vectors: [{ from: [0, 0, 0] as Vector3Tuple, to: CORNERS[corner], color: VIZ.focus, label: 'Position vector' }] }), [corner]);
    return <VisualLab backUrl="/linear-algebra" title="Explore 3D coordinates" subtitle="Read coordinates independently of the camera angle."
        legend={[{label:'Cube',meaning:'given coordinate frame',color:VIZ.data,shape:'line'},{label:'Gold',meaning:'selected point and position vector',color:VIZ.focus}]}
        controls={<LabSelect label="Select cube corner" value={String(corner)} options={CORNERS.map((value, i) => ({ value: String(i), label: `(${value.join(', ')})` }))} onChange={value => setCorner(Number(value))} />}
        metrics={[{ label: 'X coordinate', value: String(point[0]) }, { label: 'Y coordinate', value: String(point[1]) }, { label: 'Z coordinate', value: String(point[2]) }]}
        insight="Each corner is one unit from the origin along each axis. Orbiting the camera changes the view, not the cube’s coordinates."
        challenge="Choose two corners with opposite X coordinates. Orbit the camera and compare their positions against the labelled axes."
        explanation={<SceneExplanation title="3D coordinates" summary="An ordered triple locates a point relative to three coordinate axes."><ExplanationSection title="Read the cube"><p>The cube has side length two and corners (±1, ±1, ±1). The yellow arrow is a position vector from the origin to the selected corner. Its length is √3. Camera orbit, zoom, and keyboard camera controls let you inspect the same fixed geometry.</p></ExplanationSection></SceneExplanation>}>
        <SpatialScene {...scene} axes={['X coordinate', 'Y coordinate', 'Z coordinate']} description="Fixed cube with labelled X, Y and Z coordinate axes. A yellow point and vector mark the selected corner; the coordinates remain unchanged when orbiting the camera." />
    </VisualLab>;
}
