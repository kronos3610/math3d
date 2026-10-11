import { create } from '@react-three/test-renderer';
import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { MonteCarloSamples } from './MonteCarlo';
import { makeMonteCarloRun, monteCarloEstimate } from './monteCarloMath';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
test('inside and outside 3D samples use different geometry and the rendered counts match the estimate', async () => {
    let run = makeMonteCarloRun(7, 500);
    const renderer = await create(<MonteCarloSamples points={run.points} count={100} />);
    const check = (count: number) => {
        const instances = renderer.scene.findAllByType('Mesh').map(node => node.instance as THREE.InstancedMesh).filter(mesh => mesh.isInstancedMesh);
        // The test renderer and scene can load separate Three.js module realms.
        const inside = instances.find(mesh => mesh.geometry.type === 'BoxGeometry')!;
        const outside = instances.find(mesh => mesh.geometry.type === 'SphereGeometry')!;
        expect(inside.count).toBe(monteCarloEstimate(run, count).inside);
        expect(inside.count + outside.count).toBe(count);
        for (const mesh of instances) for (let index = 0; index < mesh.count; index++) {
            const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
            const squaredRadius = new THREE.Vector3().setFromMatrixPosition(matrix).lengthSq();
            expect(mesh === inside ? squaredRadius <= 1 : squaredRadius > 1).toBe(true);
        }
    };
    try {
        check(100);
        await renderer.update(<MonteCarloSamples points={run.points} count={0} />); check(0);
        run = makeMonteCarloRun(8, 2000);
        await renderer.update(<MonteCarloSamples points={run.points} count={1000} />); check(1000);
    } finally { await renderer.unmount(); }
});
