import { create } from '@react-three/test-renderer';
import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { IntegrationVisualization } from './RiemannVsLebesgue';
import { VIZ } from '../../data/palette';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

function expectTransform(mesh: THREE.InstancedMesh, index: number, expectedPosition: [number, number, number], expectedScale: [number, number, number]) {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    expectedPosition.forEach((coordinate, axis) => expect(position.getComponent(axis)).toBeCloseTo(coordinate, 5));
    expectedScale.forEach((coordinate, axis) => expect(scale.getComponent(axis)).toBeCloseTo(coordinate, 5));
}

test('thousands of Lebesgue cells share one mesh and tile the stated floor with unchanged layer samples', async () => {
    const renderer = await create(<IntegrationVisualization mode="lebesgue" functionType="smooth" resolution={12} />);
    try {
        const mesh = renderer.scene.findByProps({ name: 'integration-cells' }).instance as THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshPhongMaterial>;
        expect(renderer.scene.children).toHaveLength(1);
        expect(mesh.isInstancedMesh).toBe(true);
        // Keep the original lower-left samples; centers tile [-10,10]² exactly.
        expect(mesh.count).toBe(5170);
        expectTransform(mesh, 0, [-9.75, 0.375, -9.75], [0.5, 0.7425, 0.5]);
        expectTransform(mesh, 2585, [6.25, 1.125, 1.75], [0.5, 0.7425, 0.5]);
        expectTransform(mesh, mesh.count - 1, [9.75, 4.125, 9.75], [0.5, 0.7425, 0.5]);
        const color = new THREE.Color();
        mesh.getColorAt(0, color);
        const paletteColor = new THREE.Color(VIZ.variation);
        expect(color.r).toBeCloseTo(paletteColor.r, 6);
        expect(color.g).toBeCloseTo(paletteColor.g, 6);
        expect(color.b).toBeCloseTo(paletteColor.b, 6);
        expect(mesh.material.opacity).toBe(0.7);
        expect(mesh.material.transparent).toBe(true);
        expect(mesh.geometry.parameters).toMatchObject({ width: 1, height: 1, depth: 1 });
        expect(mesh.boundingSphere).not.toBeNull();
    } finally { await renderer.unmount(); }
});

test('switching to Riemann columns preserves midpoint heights, cell gaps, and mode opacity', async () => {
    const renderer = await create(<IntegrationVisualization mode="lebesgue" functionType="smooth" resolution={12} />);
    try {
        await renderer.update(<IntegrationVisualization mode="riemann" functionType="smooth" resolution={4} />);
        const mesh = renderer.scene.findByProps({ name: 'integration-cells' }).instance as THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshPhongMaterial>;
        expect(mesh.count).toBe(16);
        const cornerHeight = 3.836534006645409;
        expectTransform(mesh, 0, [-7.5, cornerHeight / 2, -7.5], [4.95, cornerHeight, 4.95]);
        expect(mesh.material.opacity).toBe(0.8);
        expect(mesh.instanceColor?.count).toBe(16);
    } finally { await renderer.unmount(); }
});

test('changing function and maximum refinement refreshes instance capacity without losing cells', async () => {
    const renderer = await create(<IntegrationVisualization mode="lebesgue" functionType="smooth" resolution={30} />);
    try {
        const getMesh = () => renderer.scene.findByProps({ name: 'integration-cells' }).instance as THREE.InstancedMesh;
        expect(getMesh().count).toBe(14120);
        await renderer.update(<IntegrationVisualization mode="lebesgue" functionType="spiky" resolution={30} />);
        expect(getMesh().count).toBe(1868);
        expect(getMesh().instanceMatrix.count).toBe(1868);
        await renderer.update(<IntegrationVisualization mode="lebesgue" functionType="smooth" resolution={12} />);
        expect(getMesh().count).toBe(5170);
        expect(getMesh().instanceMatrix.count).toBe(5170);
    } finally { await renderer.unmount(); }
});
