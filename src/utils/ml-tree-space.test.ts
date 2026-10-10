import { expect, test } from 'vitest';
import { cellContains, cellCenter, treeCells, treeSpaceTrace, treeDiagramLayout } from './ml-tree-space';
import { fitTree, predictTree, treeData, treePath } from './ml-trees';
import type { TreeNode } from './ml-trees';
import { treePartitionGeometry } from '../components/3d/tree-partition-geometry';

test.each([2, 3] as const)('%i-feature leaves cover the full domain once, including exact threshold ties', dimensions => {
    const data = treeData('regression', 80, 0.1, 21, dimensions);
    const tree = fitTree(data, { maxDepth: 4, minLeaf: 2 });
    const cells = treeCells(tree, Array(dimensions).fill(-1) as number[], Array(dimensions).fill(1) as number[]);
    const leaves = cells.filter(cell => !cell.node.left || !cell.node.right);
    const volume = leaves.reduce((total, cell) => total + cell.min.reduce((product, min, axis) => product * (cell.max[axis] - min), 1), 0);
    expect(volume).toBeCloseTo(2 ** dimensions, 12);
    const probes = [...data.map(row => row.x), Array(dimensions).fill(-1) as number[], Array(dimensions).fill(1) as number[]];
    for (const cell of cells) if (cell.node.feature !== undefined) {
        const tie = cellCenter(cell); tie[cell.node.feature] = cell.node.threshold!; probes.push(tie);
    }
    for (const query of probes) {
        const containing = leaves.filter(cell => cellContains(cell, query));
        expect(containing).toHaveLength(1);
        expect(containing[0].node.value).toBe(predictTree(tree, query));
        expect(containing[0].node.id).toBe(treePath(tree, query).at(-1)?.id);
    }
});

test('each query decision partitions only its active cell and exact equality goes left', () => {
    const leaf = (id: number, depth: number, value: number): TreeNode => ({ id, depth, value, risk: 0, indices: [] });
    const left = { ...leaf(1, 1, 0), feature: 1, threshold: 0.25, left: leaf(3, 2, 0.1), right: leaf(4, 2, 0.4) };
    const root = { ...leaf(0, 0, 0.5), feature: 0, threshold: 0, left, right: leaf(2, 1, 0.9) };
    const trace = treeSpaceTrace(root, [0, 0.25]);
    expect(trace.path.map(cell => cell.node.id)).toEqual([0, 1, 3]);
    expect(trace.decisions.map(decision => decision.direction)).toEqual(['left', 'left']);
    expect(trace.decisions[1].cell.max).toEqual([0, 1]);
    expect(trace.decisions[1].retained.max).toEqual([0, 0.25]);
    expect(cellContains(trace.decisions[0].excluded, [0, 0.25])).toBe(false);
    expect(cellContains(trace.decisions[0].excluded, [Number.EPSILON, 0.25])).toBe(true);
    expect(cellContains(trace.decisions[1].excluded, [0, 0.25])).toBe(false);
    const graph = treeDiagramLayout(root);
    expect(graph.positions.get(0)?.[0]).toBeCloseTo((graph.positions.get(1)![0] + graph.positions.get(2)![0]) / 2);
    expect(graph.positions.get(3)?.[1]).toBeGreaterThan(graph.positions.get(1)![1]);
});

test.each([2, 3] as const)('%i-feature spatial points are real input coordinates; cuts stay clipped and excluded points dim', dimensions => {
    const samples = treeData('classification', 48, 0.15, 3610, dimensions);
    const tree = fitTree(samples, { task: 'classification', maxDepth: 3, minLeaf: 3 });
    const query = Array(dimensions).fill(0.3) as number[];
    const trace = treeSpaceTrace(tree, query);
    const step = 1;
    const scene = treePartitionGeometry({ tree, query, step, samples, task: 'classification', title: 'Tree' });
    const active = trace.path[step];
    expect(scene.points).toHaveLength(49);
    samples.forEach((sample, i) => {
        const point = scene.points![i];
        expect(point.position[0]).toBe(sample.x[0]); expect(point.position[2]).toBe(sample.x[1]);
        expect(point.position[1]).toBe(dimensions === 3 ? sample.x[2] : 0.06);
        expect(point.color === '#475569').toBe(!cellContains(active, sample.x));
    });
    const currentCut = scene.surfaces?.at(-1);
    if (trace.decisions[step]) {
        expect(currentCut).toBeDefined();
        for (const vertex of currentCut!.vertices) {
            expect(vertex[0]).toBeGreaterThanOrEqual(active.min[0]); expect(vertex[0]).toBeLessThanOrEqual(active.max[0]);
            expect(vertex[2]).toBeGreaterThanOrEqual(active.min[1]); expect(vertex[2]).toBeLessThanOrEqual(active.max[1]);
            if (dimensions === 3) { expect(vertex[1]).toBeGreaterThanOrEqual(active.min[2]); expect(vertex[1]).toBeLessThanOrEqual(active.max[2]); }
        }
    }
    expect(scene.points!.at(-1)?.position).toEqual([0.3, dimensions === 3 ? 0.3 : 0.08, 0.3]);
});

test('adding a third feature preserves old seeded data and supplies a real additional signal', () => {
    const original = treeData('regression', 3, 0, 7);
    expect(treeData('regression', 3, 0, 7, 2)).toEqual(original);
    const three = treeData('regression', 80, 0, 7, 3);
    expect(three.every(row => row.x.length === 3 && row.x.every(value => Math.abs(value) <= 1))).toBe(true);
    const model = fitTree(three, { task: 'regression', maxDepth: 5, minLeaf: 2 });
    expect(treeCells(model).some(cell => cell.node.feature === 2)).toBe(true);
});

test('clipping a fitted split outside the displayed bounds gives no overlapping empty child', () => {
    const left: TreeNode = { id: 1, depth: 1, value: 0, risk: 0, indices: [] };
    const right: TreeNode = { id: 2, depth: 1, value: 1, risk: 0, indices: [] };
    for (const threshold of [-2, -1, 1, 2]) {
        const root: TreeNode = { id: 0, depth: 0, value: 0.5, risk: 0, indices: [], feature: 0, threshold, left, right };
        const leaves = treeCells(root).slice(1);
        for (const x of [-1, -0.5, 0, 0.5, 1]) {
            const matching = leaves.filter(cell => cellContains(cell, [x, 0]));
            expect(matching).toHaveLength(1);
            expect(matching[0].node.id).toBe(x <= threshold ? 1 : 2);
        }
    }
});
