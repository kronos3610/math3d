import { create } from '@react-three/test-renderer';
import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { DerivativeSurface } from './Derivatives';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

test('the displayed tangent direction has the actual x derivative of the surface', async () => {
    const renderer = await create(<DerivativeSurface />);
    try {
        await renderer.advanceFrames(1, 1 / 60);
        const tangent = renderer.scene.findByProps({ name: 'derivative-tangent' }).instance;
        const { x, y } = tangent.position;
        const h = 1e-5;
        const surface = (input: number) => 0.8 * Math.sin(input) * Math.cos(y);
        const finiteDifference = (surface(x + h) - surface(x - h)) / (2 * h);
        const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(tangent.quaternion);
        expect(direction.z / direction.x).toBeCloseTo(finiteDifference, 8);
    } finally { await renderer.unmount(); }
});
