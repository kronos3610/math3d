import { PerspectiveCamera, Vector3 } from 'three';
import { expect, test } from 'vitest';
import { perspectiveFitDistance, type CameraPoint, type SceneBounds } from './camera-fit';

const bounds: SceneBounds = { minimum: [-4.1, -1.6, -4.1], maximum: [5.3, 5.3, 5.3] };
test.each([[390, 700], [1180, 835], [760, 350]])('all corners project within the padded %s×%s viewport, including near-corner depth', (width, height) => {
    const target: CameraPoint = [2, 0.5, -1]; const direction: CameraPoint = [1, 0.8, 1.2];
    const distance = perspectiveFitDistance(bounds, direction, target, 50, width, height);
    const camera = new PerspectiveCamera(50, width / height, 0.01, 1000);
    camera.position.copy(new Vector3(...direction).normalize().multiplyScalar(distance).add(new Vector3(...target)));
    camera.lookAt(...target); camera.updateMatrixWorld();
    const xLimit = 1 - 2 * Math.min(64, width / 4) / width;
    const yLimit = 1 - 2 * Math.min(64, height / 4) / height;
    for (const x of [bounds.minimum[0], bounds.maximum[0]]) for (const y of [bounds.minimum[1], bounds.maximum[1]]) for (const z of [bounds.minimum[2], bounds.maximum[2]]) {
        const projected = new Vector3(x, y, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(xLimit + 1e-12);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(yLimit + 1e-12);
        expect(projected.z).toBeGreaterThan(-1); expect(projected.z).toBeLessThan(1);
    }
});

test('narrow portrait stages need more distance, rather than an unchanged vertical-only framing', () => {
    const mobile = perspectiveFitDistance(bounds, [1, 1, 1], [0, 0, 0], 75, 390, 700);
    const desktop = perspectiveFitDistance(bounds, [1, 1, 1], [0, 0, 0], 75, 1180, 835);
    expect(mobile).toBeGreaterThan(desktop * 1.8);
});


test.each([[0.02, 1, 0.02], [0, 1, 0], [0.01, -1, 0.02]] as CameraPoint[])('near-pole view %s uses the same camera-up basis as actual Three projection', (x, y, z) => {
    const direction: CameraPoint = [x, y, z]; const width = 390; const height = 750;
    const partialBounds: SceneBounds = { minimum: [-4.9, -2.3, -4.9], maximum: [4.9, 3.3, 4.9] };
    const distance = perspectiveFitDistance(partialBounds, direction, [0, 0, 0], 50, width, height);
    const camera = new PerspectiveCamera(50, width / height, 0.01, 1000);
    camera.position.copy(new Vector3(...direction).normalize().multiplyScalar(distance));
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    for (const px of [-4.9, 4.9]) for (const py of [-2.3, 3.3]) for (const pz of [-4.9, 4.9]) {
        const projected = new Vector3(px, py, pz).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(1 - 128 / width + 1e-12);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(1 - 128 / height + 1e-12);
    }
});


test('exact-pole landscape framing satisfies the vertical bound after Three’s lookAt perturbation', () => {
    const width = 760; const height = 350;
    const bounds: SceneBounds = { minimum: [-4.9, -2.3, -4.9], maximum: [4.9, 3.3, 4.9] };
    const distance = perspectiveFitDistance(bounds, [0, 1, 0], [0, 0, 0], 50, width, height);
    const camera = new PerspectiveCamera(50, width / height, 0.01, 1000);
    camera.position.set(0, distance, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    for (const x of [-4.9, 4.9]) for (const y of [-2.3, 3.3]) for (const z of [-4.9, 4.9]) {
        const projected = new Vector3(x, y, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(1 - 128 / width + 1e-12);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(1 - 128 / height + 1e-12);
    }
});
