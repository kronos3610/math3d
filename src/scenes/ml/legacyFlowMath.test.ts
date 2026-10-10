import { expect, test } from 'vitest';
import { affineFlowAt, applyAffineFlow, BALL_BASE_DENSITY, flowDeterminant, invertAffineFlow, transformedBallDensity } from './legacyFlowMath';

test('all displayed affine deformations are invertible and density compensates their actual volume change', () => {
    for (let time = 0; time < 40; time += 0.37) {
        const flow = affineFlowAt(time); const point = [1, -2, 0.5] as const;
        const output = applyAffineFlow(point, flow); const restored = invertAffineFlow(output, flow);
        restored.forEach((value, axis) => expect(value).toBeCloseTo(point[axis], 12));
        expect(flowDeterminant(flow)).toBeGreaterThan(0);
        expect(transformedBallDensity(flow) * flowDeterminant(flow)).toBeCloseTo(BALL_BASE_DENSITY, 12);
    }
});
