import { VIZ } from '../../data/palette';
import type { SpatialSceneProps, LabVector, SpatialPath, SpatialSurface, SpatialPoint } from './spatial-model';
import type { TreeSample, TreeTask } from '../../utils/ml-trees';
import type { TreeCell, TreeDecision } from '../../utils/ml-tree-space';
import { cellCenter, cellContains, treeSpaceTrace } from '../../utils/ml-tree-space';

const featurePosition = (point: readonly number[], height = 0): LabVector => [point[0], point.length === 3 ? point[2] : height, point[1]];

export function treeValueColor(value: number, task: TreeTask, min = 0, max = 1): string {
    const fraction = task === 'classification' ? value : (value - min) / Math.max(1e-9, max - min);
    const mix = Math.max(0, Math.min(1, fraction));
    return `rgb(${Math.round(96 + 155 * mix)}, ${Math.round(165 + 26 * mix)}, ${Math.round(250 - 214 * mix)})`;
}

function cellEdges(cell: TreeCell, height = 0): LabVector[][] {
    const corners = Array.from({ length: 2 ** cell.min.length }, (_, index) => cell.min.map((value, axis) => index & (1 << axis) ? cell.max[axis] : value));
    return corners.flatMap((point, index) => cell.min.flatMap((_, axis) => index & (1 << axis) ? []
        : [[featurePosition(point, height), featurePosition(corners[index | (1 << axis)], height)]]));
}

function cut(decision: TreeDecision, dimensions: 2 | 3): { surface: SpatialSurface; outline: SpatialPath; floor: SpatialPath } {
    const { cell, feature, threshold } = decision;
    const other = cell.min.map((_, axis) => axis).filter(axis => axis !== feature);
    const corners = [0, 1, 2, 3].map(index => {
        const point = [...cell.min]; point[feature] = Math.max(cell.min[feature], Math.min(cell.max[feature], threshold));
        point[other[0]] = index & 1 ? cell.max[other[0]] : cell.min[other[0]];
        if (dimensions === 3) point[other[1]] = index & 2 ? cell.max[other[1]] : cell.min[other[1]];
        return featurePosition(point, index & 2 ? 0.65 : 0.02);
    });
    return { surface: { vertices: corners, columns: 2, color: VIZ.truth, opacity: dimensions === 3 ? 0.16 : 0.2 },
        outline: { points: [corners[0], corners[1], corners[3], corners[2], corners[0]], color: VIZ.truth, width: 2 },
        floor: { points: [corners[0], corners[1]], color: VIZ.truth, width: 3 } };
}

interface PartitionOptions {
    tree: Parameters<typeof treeSpaceTrace>[0];
    query: readonly number[];
    step: number;
    samples: readonly TreeSample[];
    task: TreeTask;
    colors?: readonly string[];
    radii?: readonly number[];
    title: string;
}

/** Plot feature coordinates only. Response values are colors, never an input-space axis. */
export function treePartitionGeometry({ tree, query, step, samples, task, colors, radii, title }: PartitionOptions): SpatialSceneProps {
    const trace = treeSpaceTrace(tree, query);
    const currentIndex = Math.min(Math.max(0, step), trace.path.length - 1);
    const current = trace.path[currentIndex];
    const dimensions: 2 | 3 = query.length === 3 ? 3 : 2;
    const values = trace.leaves.map(cell => cell.node.value);
    const min = Math.min(...values); const max = Math.max(...values);
    const paths: SpatialPath[] = cellEdges(trace.path[0], 0.005).map(points => ({ points, color: VIZ.axis, width: 1 }));
    paths.push(...cellEdges(current, 0.025).map(points => ({ points, color: VIZ.white, width: 3 })));
    const surfaces: SpatialSurface[] = [];
    for (const decision of trace.decisions.slice(0, currentIndex)) {
        const geometry = cut(decision, dimensions);
        if (dimensions === 2) paths.push({ ...geometry.floor, color: VIZ.axis, width: 1, dashed: true });
        else { surfaces.push({ ...geometry.surface, opacity: 0.04 }); paths.push({ ...geometry.outline, color: VIZ.axis, width: 1 }); }
    }
    const decision = trace.decisions[currentIndex];
    if (decision) { const geometry = cut(decision, dimensions); surfaces.push(geometry.surface); paths.push(geometry.outline, geometry.floor); }
    const boxes = trace.leaves.map(cell => {
        const center = cellCenter(cell);
        const size: LabVector = [cell.max[0] - cell.min[0], dimensions === 3 ? cell.max[2] - cell.min[2] : 0.015, cell.max[1] - cell.min[1]];
        return { position: featurePosition(center, -0.015), size, color: treeValueColor(cell.node.value, task, min, max), opacity: dimensions === 3 ? 0.035 : 0.25 };
    });
    const points: SpatialPoint[] = samples.map((sample, index) => {
        const retained = cellContains(current, sample.x);
        return { position: featurePosition(sample.x, 0.06), radius: retained ? radii?.[index] ?? 0.09 : 0.055,
            color: retained ? colors?.[index] ?? treeValueColor(sample.y, task, min, max) : VIZ.muted };
    });
    points.push({ position: featurePosition(query, 0.08), radius: 0.16, color: VIZ.white, label: 'query' });
    const vectors = decision ? [{ from: featurePosition(cellCenter(current), 0.12),
        to: featurePosition(cellCenter(decision.retained), 0.12), color: VIZ.truth }] : [];
    return { points, paths, surfaces, boxes, vectors,
        axes: dimensions === 3 ? ['Feature x₁', 'Feature x₃', 'Feature x₂'] : ['Feature x₁', 'Threshold wall height (illustration)', 'Feature x₂'],
        cameraPosition: dimensions === 3 ? [8, 6, -9] : [7, 9, -9],
        description: `${title}: ${dimensions === 3 ? 'three real feature coordinates in a cube' : 'two real feature coordinates on the floor; wall height is illustrative, not a feature or prediction'}. White outline is the retained query region. Teal is the current threshold plane, clipped to that region. Gray observations are excluded by earlier decisions. Leaf color shows ${task === 'classification' ? 'the class-1 fraction' : 'the selected tree leaf value'}.` };
}
