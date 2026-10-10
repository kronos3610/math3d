import { Profiler, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { create } from '@react-three/test-renderer';
import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { BayesPopulation } from './BayesPopulation';
import { createBayesPopulationLayout } from './bayesPopulationLayout';
import type { BayesView, Position3 } from './bayesPopulationLayout';

// Only substitute the browser HTML portal. Geometry, materials, instancing,
// weighted layout, camera fitting, and frame subscriptions remain real.
vi.mock('@react-three/drei', () => ({
    Html: ({ position, children }: { position: Position3; children: ReactNode }) =>
        <group position={position} name={isValidElement<{ children: string }>(children) ? `label-${children.props.children}` : 'label'} />,
}));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

const parameters = { prior: 0.1, likelihood: 0.9, falsePositiveRate: 0.1 };

function makeCamera(width: number, height: number): THREE.OrthographicCamera {
    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 100);
    camera.position.set(0, 12, 16);
    camera.lookAt(0, 0, 0);
    return camera;
}

test('one real instanced mesh preserves selected weights and moves only flags into their own board', async () => {
    const camera = makeCamera(900, 450);
    const renderer = await create(<BayesPopulation parameters={parameters} view="conditional" />,
        { width: 900, height: 450, size: { width: 900, height: 450, top: 0, left: 0 }, camera });
    try {
        expect(renderer.scene.findAll(node => (node.instance as THREE.InstancedMesh).isInstancedMesh)).toHaveLength(1);
        const mesh = renderer.scene.findByProps({ name: 'email-tiles' }).instance as THREE.InstancedMesh;
        const layout = createBayesPopulationLayout(parameters, 'conditional');
        const selectedBoard = layout.selectedBoard;
        if (!selectedBoard) throw new Error('Expected a conditional board.');
        expect(mesh.count).toBeLessThanOrEqual(1003);
        expect(mesh.geometry.type).toBe('BoxGeometry');
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        let totalWeight = 0;
        let selectedSpamWeight = 0;
        let selectedOrdinaryWeight = 0;
        for (let index = 0; index < mesh.count; index++) {
            mesh.getMatrixAt(index, matrix);
            matrix.decompose(position, quaternion, scale);
            const weight = scale.x / scale.y;
            totalWeight += weight;
            const piece = layout.pieces[index];
            if (piece.flagged) {
                expect(position.x).toBeGreaterThan(selectedBoard.position[0] - selectedBoard.width / 2);
                if (piece.event) selectedSpamWeight += weight;
                else selectedOrdinaryWeight += weight;
            } else expect(position.x).toBeLessThan(layout.sourceBoard.position[0] + layout.sourceBoard.width / 2);
        }
        expect(totalWeight).toBeCloseTo(1000, 3);
        expect(selectedSpamWeight).toBeCloseTo(90, 4);
        expect(selectedOrdinaryWeight).toBeCloseTo(90, 4);
        expect(renderer.scene.findByProps({ name: 'label-Not flagged · 820' })).toBeDefined();
        expect(renderer.scene.findByProps({ name: 'label-Flagged group · 180' })).toBeDefined();
    } finally { await renderer.unmount(); }
});

test('flag and conditional transitions update actual instance matrices without React frame commits and settle', async () => {
    let renders = 0;
    const scene = (view: BayesView) => <Profiler id="population" onRender={() => { renders++; }}>
        <BayesPopulation parameters={parameters} view={view} />
    </Profiler>;
    const renderer = await create(scene('population'), {
        width: 900, height: 450, size: { width: 900, height: 450, top: 0, left: 0 }, camera: makeCamera(900, 450),
    });
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    try {
        const mesh = renderer.scene.findByProps({ name: 'email-tiles' }).instance as THREE.InstancedMesh;
        mesh.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix);
        expect(position.z).toBe(0);
        await renderer.update(scene('flags'));
        const layout = createBayesPopulationLayout(parameters, 'flags');
        const unflaggedSpam = layout.pieces.findIndex(piece => piece.event && !piece.flagged);
        const flaggedColor = new THREE.Color();
        const unflaggedColor = new THREE.Color();
        mesh.getColorAt(0, flaggedColor); mesh.getColorAt(unflaggedSpam, unflaggedColor);
        expect(flaggedColor.r).toBeGreaterThan(unflaggedColor.r);
        const commitsAfterUpdate = renders;
        await renderer.advanceFrames(10, 1 / 60);
        mesh.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix);
        expect(position.z).toBeGreaterThan(0);
        expect(position.z).toBeLessThan(1.1);
        await renderer.advanceFrames(60, 1 / 60);
        mesh.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix);
        expect(position.z).toBeCloseTo(1.1, 6);
        expect(renders).toBe(commitsAfterUpdate);

        await renderer.update(scene('conditional'));
        await renderer.advanceFrames(60, 1 / 60);
        mesh.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix);
        expect(position.x).toBeGreaterThan(0);
        expect(position.z).toBeCloseTo(0.35, 6);
        const settledMatrices = Array.from(mesh.instanceMatrix.array);
        const settledCommits = renders;
        await renderer.advanceFrames(20, 1 / 60);
        expect(Array.from(mesh.instanceMatrix.array)).toEqual(settledMatrices);
        expect(renders).toBe(settledCommits);
    } finally { await renderer.unmount(); }
});

test.each([{ width: 900, height: 450 }, { width: 350, height: 450 }])('orthographic fit keeps both boards visible at $width×$height', async ({ width, height }) => {
    const camera = makeCamera(width, height);
    const renderer = await create(<BayesPopulation parameters={parameters} view="conditional" />,
        { width, height, size: { width, height, top: 0, left: 0 }, camera });
    try {
        const layout = createBayesPopulationLayout(parameters, 'conditional', width < height ? 'vertical' : 'horizontal');
        for (const board of [layout.sourceBoard, layout.selectedBoard]) {
            if (!board) continue;
            for (const x of [-board.width / 2, board.width / 2]) {
                for (const y of [-board.height / 2, board.height / 2]) {
                    const projected = new THREE.Vector3(board.position[0] + x, board.position[1] + y, 0).project(camera);
                    expect(Math.abs(projected.x)).toBeLessThan(0.96);
                    expect(Math.abs(projected.y)).toBeLessThan(0.96);
                }
            }
        }
    } finally { await renderer.unmount(); }
});
