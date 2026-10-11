import { create } from '@react-three/test-renderer';
import { Mesh } from 'three';
import { expect, test, vi } from 'vitest';
import { DescentTrajectory } from './DescentTrajectory';
import { quadraticLoss } from '../../utils/optimization';
import { VIZ } from '../../data/palette';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

test('replacing a trajectory resets its ball immediately even while local playback is paused', async () => {
    const renderer = await create(<DescentTrajectory path={[[3, 2], [0, 0]]} loss={quadraticLoss} color={VIZ.focus} />);
    try {
        await renderer.advanceFrames(20, 0.05);
        const ball = renderer.scene.findByProps({ name: 'descent-marker' }).instance as Mesh;
        expect(ball.position.x).toBeCloseTo(0);
        await renderer.update(<DescentTrajectory path={[[-2, 1], [0, 0]]} loss={quadraticLoss} color={VIZ.focus} playing={false} />);
        expect(ball.position.toArray()).toEqual([-2, 2.65, 1]);
        await renderer.advanceFrames(2, 0.05);
        expect(ball.position.toArray()).toEqual([-2, 2.65, 1]);
    } finally { await renderer.unmount(); }
});
