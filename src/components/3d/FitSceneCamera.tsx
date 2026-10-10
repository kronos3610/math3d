import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, type Camera, type PerspectiveCamera } from 'three';
import { perspectiveFitDistance, type CameraPoint, type SceneBounds } from './camera-fit';

interface FitSceneCameraProps { bounds: SceneBounds; padding?: number; }
interface OrbitState { target?: Vector3; update?: () => void; saveState?: () => void; }
function isPerspective(camera: Camera): camera is PerspectiveCamera { return 'isPerspectiveCamera' in camera && camera.isPerspectiveCamera === true; }

/** Fit on mount or viewport changes; ordinary model edits and manual orbit do not reset the view. */
export function FitSceneCamera({ bounds, padding = 64 }: FitSceneCameraProps) {
    const { camera, size, invalidate } = useThree();
    const controls = useThree(state => state.controls);
    const [minX, minY, minZ] = bounds.minimum;
    const [maxX, maxY, maxZ] = bounds.maximum;
    useLayoutEffect(() => {
        if (!isPerspective(camera) || size.width <= 0 || size.height <= 0) return;
        const orbit = controls as OrbitState | undefined;
        const target = orbit?.target?.clone() ?? new Vector3();
        const direction = camera.position.clone().sub(target).normalize();
        if (direction.lengthSq() === 0) direction.set(1, 0.8, 1).normalize();
        const distance = perspectiveFitDistance({ minimum: [minX, minY, minZ], maximum: [maxX, maxY, maxZ] }, direction.toArray() as CameraPoint, target.toArray() as CameraPoint, camera.fov, size.width, size.height, padding, camera.up.toArray() as CameraPoint);
        // Three cameras are mutable renderer objects; update the viewport projection imperatively.
        // eslint-disable-next-line react-hooks/immutability
        camera.aspect = size.width / size.height;
        camera.position.copy(direction.multiplyScalar(distance).add(target));
        camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
        orbit?.update?.();
        // Reset must return to the fitted viewport rather than the pre-fit camera.
        orbit?.saveState?.();
        invalidate();
    }, [camera, controls, size.width, size.height, minX, minY, minZ, maxX, maxY, maxZ, padding, invalidate]);
    return null;
}
