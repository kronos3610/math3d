export type FlowPoint = readonly [number, number, number];
export interface AffineFlow { scale: FlowPoint; xyShear: number; yzShear: number; }
export function affineFlowAt(time: number): AffineFlow {
    return { scale: [1.2 + 0.6 * Math.sin(time * 0.5), 1 + 0.35 * Math.cos(time * 0.4), 0.9 + 0.25 * Math.sin(time * 0.3)], xyShear: 0.3 * Math.sin(time), yzShear: 0.25 * Math.cos(time) };
}
export function flowDeterminant(flow: AffineFlow): number { return flow.scale[0] * flow.scale[1] * flow.scale[2]; }
export function applyAffineFlow([x, y, z]: FlowPoint, flow: AffineFlow): FlowPoint {
    return [flow.scale[0] * x, flow.scale[1] * y + flow.xyShear * x, flow.scale[2] * z + flow.yzShear * y];
}
export function invertAffineFlow([x, y, z]: FlowPoint, flow: AffineFlow): FlowPoint {
    const originalX = x / flow.scale[0];
    const originalY = (y - flow.xyShear * originalX) / flow.scale[1];
    return [originalX, originalY, (z - flow.yzShear * originalY) / flow.scale[2]];
}
export const BALL_BASE_DENSITY = 3 / (32 * Math.PI); // Uniform probability density in radius-two ball.
export function transformedBallDensity(flow: AffineFlow): number { return BALL_BASE_DENSITY / Math.abs(flowDeterminant(flow)); }
