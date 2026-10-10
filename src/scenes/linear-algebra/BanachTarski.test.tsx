import { Profiler } from 'react';
import { create } from '@react-three/test-renderer';
import { expect, test, vi } from 'vitest';
import { AnimationController, BanachTarskiScene } from './BanachTarski';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

test('decomposition moves real Three.js meshes without React commits on each frame', async () => {
    const progress = { current: 0 };
    let renders = 0;
    const scene = (split: boolean) => (
        <Profiler id="decomposition" onRender={() => { renders++; }}>
            <BanachTarskiScene animationProgress={progress} />
            <AnimationController isSplit={split} progressRef={progress} />
        </Profiler>
    );
    const renderer = await create(scene(true));
    try {
        const initialRenders = renders;
        await renderer.advanceFrames(90, 1 / 60);
        // The renderer advances each subscription in turn, so apply the updated
        // controller value to the piece subscriptions on the following pass.
        await renderer.advanceFrames(1, 1 / 60);
        expect(progress.current).toBeGreaterThan(0.99);
        const meshes = renderer.scene.findAllByType('Mesh');
        expect(meshes).toHaveLength(10);
        expect(Math.abs(meshes[0].instance.position.x)).toBeGreaterThan(4.4);
        expect(renders).toBe(initialRenders);

        await renderer.update(scene(false));
        await renderer.advanceFrames(90, 1 / 60);
        await renderer.advanceFrames(1, 1 / 60);
        expect(progress.current).toBeLessThan(0.01);
        expect(Math.abs(meshes[0].instance.position.x)).toBeLessThan(0.05);
    } finally {
        await renderer.unmount();
    }
});
