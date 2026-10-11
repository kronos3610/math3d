export type LabVector = [number, number, number];
export interface SpatialPoint { position: LabVector; color?: string; radius?: number; label?: string; }
export interface SpatialPath { points: LabVector[]; color?: string; width?: number; dashed?: boolean; }
export interface SpatialVector { from: LabVector; to: LabVector; color?: string; label?: string; }
export interface SpatialBox { position: LabVector; size: LabVector; color?: string; opacity?: number; label?: string; }
export interface SpatialSurface { vertices: LabVector[]; columns: number; color?: string; opacity?: number; }
export interface SpatialSceneProps {
    points?: readonly SpatialPoint[]; paths?: readonly SpatialPath[]; vectors?: readonly SpatialVector[];
    boxes?: readonly SpatialBox[]; surfaces?: readonly SpatialSurface[];
    axes?: readonly [string, string, string]; description: string; equalScale?: boolean;
    /** Preserve geometry within a coordinate pair while scaling the third, unrelated axis. */
    equalAxes?: readonly [0 | 1 | 2, 0 | 1 | 2];
    cameraPosition?: LabVector;
    /** Fit a sampled direction cloud itself, rather than its conservative bounding cube. */
    fitPoints?: boolean;
}
/** Shared normalization is isotropic by default so angles and margins remain meaningful. */
export function spatialTransform(props: SpatialSceneProps) {
    const coordinates: LabVector[] = [...(props.points ?? []).map(point => point.position),
        ...(props.paths ?? []).flatMap(path => path.points), ...(props.vectors ?? []).flatMap(vector => [vector.from, vector.to]),
        ...(props.surfaces ?? []).flatMap(surface => surface.vertices),
        ...(props.boxes ?? []).flatMap(box => [-1, 1].map(sign => box.position.map((value, axis) => value + sign * box.size[axis] / 2) as LabVector))];
    coordinates.push([0, 0, 0]);
    const minimum = [0, 1, 2].map(axis => Math.min(...coordinates.map(point => point[axis]))) as LabVector;
    const maximum = [0, 1, 2].map(axis => Math.max(...coordinates.map(point => point[axis]))) as LabVector;
    const span = maximum.map((value, axis) => Math.max(1e-6, value - minimum[axis])) as LabVector;
    const center = maximum.map((value, axis) => (value + minimum[axis]) / 2) as LabVector;
    const scale = props.equalScale === false ? span.map(value => 7 / value) as LabVector : [7 / Math.max(...span), 7 / Math.max(...span), 7 / Math.max(...span)] as LabVector;
    if (props.equalScale === false && props.equalAxes) {
        const [a,b] = props.equalAxes;
        scale[a] = scale[b] = 7 / Math.max(span[a],span[b]);
    }
    const map = (point: LabVector): LabVector => point.map((value, axis) => (value - center[axis]) * scale[axis]) as LabVector;
    return { minimum, maximum, scale, map };
}
