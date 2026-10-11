import { create } from '@react-three/test-renderer';
import { BufferGeometry, Mesh } from 'three';
import { expect, test, vi } from 'vitest';
import { HeightField } from './HeightField';
import { sampleHeightField } from './height-field-geometry';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

test('height-field vertices are directly y-up function values in the original input units', async () => {
    const f = (x: number, y: number) => x * x - 2 * y;
    const renderer = await create(<HeightField f={f} extent={6} resolution={8} />);
    const mesh = renderer.scene.findByProps({ name: 'height-field' }).instance as Mesh<BufferGeometry>;
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    const positions = mesh.geometry.getAttribute('position');
    expect(mesh.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(positions.count).toBe(81);
    for (let index = 0; index < positions.count; index++) expect(positions.getY(index)).toBeCloseTo(f(positions.getX(index), positions.getZ(index)), 7);
    expect(positions.getX(0)).toBe(-3); expect(positions.getZ(0)).toBe(-3);
    await renderer.unmount();
    expect(dispose).toHaveBeenCalled();
});

test('function changes replace and dispose the old height field without retaining stale samples', async () => {
    const renderer = await create(<HeightField f={() => 1} extent={4} resolution={2} />);
    const old = (renderer.scene.findByProps({ name: 'height-field' }).instance as Mesh<BufferGeometry>).geometry;
    const dispose = vi.spyOn(old, 'dispose');
    try {
        await renderer.update(<HeightField f={(x, y) => x + y} extent={4} resolution={4} />);
        const geometry = (renderer.scene.findByProps({ name: 'height-field' }).instance as Mesh<BufferGeometry>).geometry;
        expect(geometry).not.toBe(old); expect(dispose).toHaveBeenCalled();
        expect(geometry.getAttribute('position').getY(0)).toBe(-4);
    } finally { await renderer.unmount(); }
});

test('invalid or nonfinite height fields are rejected before geometry creation', () => {
    expect(() => sampleHeightField(() => Infinity, 6, 4)).toThrow();
    expect(() => sampleHeightField(() => 1, 0, 4)).toThrow();
    expect(() => sampleHeightField(() => 1, 6, 2.5)).toThrow();
});
