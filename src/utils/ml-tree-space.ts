import { treePath } from './ml-trees';
import type { TreeNode } from './ml-trees';

export type FeaturePair = [number, number];
export interface TreeCell {
    node: TreeNode;
    min: number[];
    max: number[];
    minInclusive: boolean[];
    maxInclusive: boolean[];
}
export interface TreeDecision {
    cell: TreeCell;
    feature: number;
    threshold: number;
    direction: 'left' | 'right';
    retained: TreeCell;
    excluded: TreeCell;
}

/** Feature-space cells keep the model's exact <= versus > boundary ownership. */
const featureCount = (node: TreeNode): number => Math.max(2, (node.feature ?? 0) + 1, node.left ? featureCount(node.left) : 2, node.right ? featureCount(node.right) : 2);

export function treeCells(tree: TreeNode, min = Array(featureCount(tree)).fill(-1) as number[], max = Array(featureCount(tree)).fill(1) as number[]): TreeCell[] {
    if (min.length !== max.length || min.length < 2 || min.length > 3 || min.some((value, axis) => !Number.isFinite(value) || !Number.isFinite(max[axis]) || value > max[axis])) {
        throw new RangeError('Tree feature bounds must be finite and ordered.');
    }
    const cells: TreeCell[] = [];
    const visit = (cell: TreeCell) => {
        cells.push(cell);
        const { node } = cell;
        if (!node.left || !node.right || node.feature === undefined || node.threshold === undefined) return;
        if (node.feature < 0 || node.feature >= min.length) throw new RangeError('The split feature must fit the displayed bounds.');
        const feature = node.feature;
        const left: TreeCell = { ...cell, node: node.left, min: [...cell.min], max: [...cell.max],
            minInclusive: [...cell.minInclusive], maxInclusive: [...cell.maxInclusive] };
        const right: TreeCell = { ...cell, node: node.right, min: [...cell.min], max: [...cell.max],
            minInclusive: [...cell.minInclusive], maxInclusive: [...cell.maxInclusive] };
        if (node.threshold <= cell.max[feature]) {
            left.max[feature] = node.threshold;
            left.maxInclusive[feature] = true;
        }
        if (node.threshold >= cell.min[feature]) {
            right.min[feature] = node.threshold;
            right.minInclusive[feature] = false;
        }
        // A split outside the viewing domain produces an empty clipped cell.
        left.max[feature] = Math.max(cell.min[feature], left.max[feature]);
        right.min[feature] = Math.min(cell.max[feature], right.min[feature]);
        if (node.threshold < cell.min[feature]) left.maxInclusive[feature] = false;
        if (node.threshold >= cell.max[feature]) right.minInclusive[feature] = false;
        visit(left); visit(right);
    };
    visit({ node: tree, min: [...min], max: [...max], minInclusive: min.map(() => true), maxInclusive: max.map(() => true) });
    return cells;
}

export function cellContains(cell: TreeCell, point: readonly number[]): boolean {
    return cell.min.every((_, axis) => Number.isFinite(point[axis])
        && (point[axis] > cell.min[axis] || (cell.minInclusive[axis] && point[axis] === cell.min[axis]))
        && (point[axis] < cell.max[axis] || (cell.maxInclusive[axis] && point[axis] === cell.max[axis])));
}

export function treeSpaceTrace(tree: TreeNode, query: readonly number[]) {
    const cells = treeCells(tree, query.map(() => -1), query.map(() => 1));
    const byId = new Map(cells.map(cell => [cell.node.id, cell]));
    const path = treePath(tree, query).map(node => byId.get(node.id)!);
    const decisions: TreeDecision[] = path.slice(0, -1).map((cell, index) => {
        const feature = cell.node.feature!;
        const direction = query[feature] <= cell.node.threshold! ? 'left' : 'right';
        const excludedNode = direction === 'left' ? cell.node.right! : cell.node.left!;
        return { cell, feature, threshold: cell.node.threshold!, direction,
            retained: path[index + 1], excluded: byId.get(excludedNode.id)! };
    });
    return { cells, path, decisions, leaves: cells.filter(cell => !cell.node.left || !cell.node.right) };
}

export function cellCenter(cell: TreeCell): number[] {
    return cell.min.map((value, axis) => (value + cell.max[axis]) / 2);
}

export const treeNodeRule = (node: TreeNode) => node.feature === undefined ? `Leaf: ${node.value.toFixed(3)}`
    : `x${node.feature + 1} ≤ ${node.threshold!.toFixed(3)}`;

/** Screen coordinates represent graph layout only, never a third data feature. */
export function treeDiagramLayout(tree: TreeNode) {
    const cells = treeCells(tree);
    const leaves = cells.filter(cell => !cell.node.left || !cell.node.right).map(cell => cell.node);
    const positions = new Map<number, FeaturePair>();
    const maxDepth = Math.max(...cells.map(cell => cell.node.depth));
    const position = (node: TreeNode): FeaturePair => {
        const x = node.left && node.right ? (position(node.left)[0] + position(node.right)[0]) / 2
            : leaves.length === 1 ? 0.5 : 0.06 + 0.88 * leaves.indexOf(node) / (leaves.length - 1);
        const result: FeaturePair = [x, 0.1 + 0.8 * node.depth / Math.max(1, maxDepth)];
        positions.set(node.id, result); return result;
    };
    position(tree);
    return { cells, positions, leaves, maxDepth };
}
