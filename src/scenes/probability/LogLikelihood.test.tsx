import { create } from '@react-three/test-renderer';
import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { ProbabilityDome } from './LogLikelihood';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

test('the shared dome geometry updates only for parameters and peaks at the actual world mean', async () => {
    const renderer = await create(<ProbabilityDome muX={0} muZ={0} sigma={2} />);
    const meshes = () => renderer.scene.findAllByType('Mesh').map(node => node.instance as THREE.Mesh<THREE.PlaneGeometry>);
    const verifyDome = (geometry: THREE.PlaneGeometry, muX: number, muZ: number, sigma: number) => {
        const positions = geometry.getAttribute('position');
        let peak = 0;
        for (let i = 0; i < positions.count; i++) {
            const distanceSquared = (positions.getX(i) - muX) ** 2 + (positions.getZ(i) - muZ) ** 2;
            const expectedHeight = Math.max(0.05, 15 / sigma * Math.exp(-distanceSquared / (2 * sigma ** 2)));
            expect(positions.getY(i)).toBeCloseTo(expectedHeight, 4);
            if (positions.getY(i) > positions.getY(peak)) peak = i;
        }
        expect(positions.getX(peak)).toBeCloseTo(muX, 5);
        expect(positions.getZ(peak)).toBeCloseTo(muZ, 5);
        expect(geometry.getAttribute('normal').count).toBe(positions.count);
        return positions;
    };
    try {
        expect(meshes()).toHaveLength(2);
        const initial = meshes()[0].geometry;
        expect(meshes()[1].geometry).toBe(initial);
        const positions = verifyDome(initial, 0, 0, 2);
        const positionVersion = positions.version;
        const normalVersion = initial.getAttribute('normal').version;
        const disposeInitial = vi.spyOn(initial, 'dispose');
        await renderer.advanceFrames(10, 1 / 60);
        await renderer.update(<ProbabilityDome muX={0} muZ={0} sigma={2} />);
        expect(meshes()[0].geometry).toBe(initial);
        expect(positions.version).toBe(positionVersion);
        expect(initial.getAttribute('normal').version).toBe(normalVersion);

        await renderer.update(<ProbabilityDome muX={1} muZ={2} sigma={1} />);
        const changed = meshes()[0].geometry;
        expect(changed).not.toBe(initial);
        expect(meshes()[1].geometry).toBe(changed);
        expect(disposeInitial).toHaveBeenCalled();
        verifyDome(changed, 1, 2, 1);
        const disposeChanged = vi.spyOn(changed, 'dispose');
        await renderer.unmount();
        expect(disposeChanged).toHaveBeenCalled();
    } finally {
        await renderer.unmount();
    }
});
