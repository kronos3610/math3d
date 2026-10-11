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

test('a controlled derivative point stays fixed on the y-up surface with the true world tangent slope', async () => {
    const point = { x: 0.8, y: 0.6 };
    const renderer = await create(<DerivativeSurface point={point} />);
    try {
        await renderer.advanceFrames(3, 0.1);
        const tangent = renderer.scene.findByProps({ name: 'derivative-tangent' }).instance;
        const position = tangent.getWorldPosition(new THREE.Vector3());
        expect(position.x).toBeCloseTo(point.x, 12);
        expect(position.z).toBeCloseTo(point.y, 12);
        expect(position.y).toBeCloseTo(0.8 * Math.sin(point.x) * Math.cos(point.y), 12);
        const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(tangent.getWorldQuaternion(new THREE.Quaternion()));
        expect(direction.y / direction.x).toBeCloseTo(0.8 * Math.cos(point.x) * Math.cos(point.y), 12);
    } finally { await renderer.unmount(); }
});
