import { create } from '@react-three/test-renderer';
import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { DecisionPlane } from './DecisionBoundaries';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
test('the displayed boundary normal separates every possible generated cluster corner', async () => {
    const renderer = await create(<DecisionPlane />);
    try {
        const plane = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
        for (const [classId, center] of [[0, [-1.5, -1, 0]], [1, [1.5, 1, 0]]] as const) {
            for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
                const score = normal.dot(new THREE.Vector3(center[0] + x, center[1] + y, center[2] + z));
                expect(classId === 0 ? -score : score).toBeGreaterThan(0);
            }
        }
        expect(normal.z).toBeCloseTo(0, 12);
    } finally { await renderer.unmount(); }
});
