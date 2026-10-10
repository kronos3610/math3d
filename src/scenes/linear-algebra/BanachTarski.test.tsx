import { Profiler } from 'react';
import { create } from '@react-three/test-renderer';
import { expect, test, vi } from 'vitest';
import { AnimationController, BanachTarskiScene } from './BanachTarski';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const motion = vi.hoisted(() => ({ moving: true }));
vi.mock('../../hooks/useSceneMotion', () => ({ useSceneMotion: () => motion.moving }));

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


test('paused motion snaps manual decomposition targets while the scene itself stays still', async () => {
    motion.moving = false;
    const progress = { current: 0 };
    const scene = (split: boolean) => <><BanachTarskiScene animationProgress={progress} /><AnimationController isSplit={split} progressRef={progress} /></>;
    const renderer = await create(scene(true));
    try {
        expect(progress.current).toBe(1);
        await renderer.advanceFrames(1, 1 / 60);
        const meshes = renderer.scene.findAllByType('Mesh');
        expect(Math.abs(meshes[0].instance.position.x)).toBe(4.5);
        const group = renderer.scene.findAllByType('Group')[0].instance;
        expect(group.rotation.y).toBe(0);
        await renderer.update(scene(false));
        await renderer.advanceFrames(1, 1 / 60);
        expect(progress.current).toBe(0);
        expect(meshes[0].instance.position.x).toBe(0);
        expect(group.rotation.y).toBe(0);
    } finally { await renderer.unmount(); motion.moving = true; }
});
