import { Matrix4, Vector3 } from 'three';

export type CameraPoint = readonly [number, number, number];
export interface SceneBounds { minimum: CameraPoint; maximum: CameraPoint; }

/** Distance along a fixed view direction that fits every box corner, including its depth. */
export function perspectiveFitDistance(bounds: SceneBounds, direction: CameraPoint, target: CameraPoint, fov: number, width: number, height: number, padding = 64, cameraUp: CameraPoint = [0, 1, 0], verticalPadding = padding): number {
    if (!(width > 0 && height > 0 && fov > 0 && fov < 180)) throw new Error('Use positive viewport dimensions and a perspective field of view.');
    const outward = new Vector3(...direction).normalize();
    if (outward.lengthSq() === 0) throw new Error('The viewing direction must be nonzero.');
    // Match Three's camera.lookAt basis and its exact-pole fallback, not a
    // different arbitrary up vector near the pole.
    const basis = new Matrix4().lookAt(outward, new Vector3(), new Vector3(...cameraUp));
    const right = new Vector3().setFromMatrixColumn(basis, 0);
    const up = new Vector3().setFromMatrixColumn(basis, 1);
    const back = new Vector3().setFromMatrixColumn(basis, 2);
    const alignment = outward.dot(back);
    const horizontalOffset = outward.dot(right);
    const verticalOffset = outward.dot(up);
    const tangent = Math.tan(fov * Math.PI / 360);
    const horizontal = tangent * width / height * (1 - 2 * Math.min(padding, width / 4) / width);
    const vertical = tangent * (1 - 2 * Math.min(verticalPadding, height / 4) / height);
    const center = new Vector3(...target);
    let distance = 0.1;
    for (const x of [bounds.minimum[0], bounds.maximum[0]]) for (const y of [bounds.minimum[1], bounds.maximum[1]]) for (const z of [bounds.minimum[2], bounds.maximum[2]]) {
        const offset = new Vector3(x, y, z).sub(center);
        const forward = offset.dot(back);
        const r = offset.dot(right); const u = offset.dot(up);
        // At an exact pole Three perturbs the lookAt basis, so the camera's
        // position ray also has tiny right/up components. Keep both sides of
        // each projection inequality rather than assuming these are zero.
        distance = Math.max(distance,
            (forward + 0.1) / alignment,
            (r + horizontal * forward) / (horizontal * alignment + horizontalOffset),
            (-r + horizontal * forward) / (horizontal * alignment - horizontalOffset),
            (u + vertical * forward) / (vertical * alignment + verticalOffset),
            (-u + vertical * forward) / (vertical * alignment - verticalOffset));
    }
    return distance;
}
