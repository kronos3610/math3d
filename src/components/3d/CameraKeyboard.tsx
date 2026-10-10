import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, Spherical, Vector3 } from 'three';
import { useSceneMotion } from '../../hooks/useSceneMotion';

interface OrbitTarget { target: Vector3; update: () => void; autoRotate?: boolean; minDistance?: number; maxDistance?: number; }
function orbitTarget(value: unknown): OrbitTarget | undefined {
    if (!value || typeof value !== 'object' || !('target' in value) || !(value.target instanceof Vector3)
        || !('update' in value) || typeof value.update !== 'function') return;
    return value as OrbitTarget;
}

export function CameraKeyboard({ description }: { description: string }) {
    const { gl, camera, invalidate, get } = useThree();
    const activeControls = useThree(state => state.controls);
    const moving = useSceneMotion();
    useEffect(() => {
        const controls = orbitTarget(activeControls);
        if (moving || !controls || !controls.autoRotate) return;
        controls.autoRotate = false;
        return () => { controls.autoRotate = true; };
    }, [activeControls, moving]);
    useEffect(() => {
        const canvas = gl.domElement;
        canvas.setAttribute('tabindex', '0');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${description} Arrow keys rotate; plus and minus zoom.`);
        const offset = new Vector3(); const origin = new Vector3(); const spherical = new Spherical();
        const keyDown = (event: KeyboardEvent) => {
            if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key)) return;
            event.preventDefault();
            const controls = orbitTarget(get().controls);
            const target = controls?.target ?? origin;
            spherical.setFromVector3(offset.copy(camera.position).sub(target));
            if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
            if (event.key === 'ArrowRight') spherical.theta += 0.12;
            if (event.key === 'ArrowUp') spherical.phi -= 0.12;
            if (event.key === 'ArrowDown') spherical.phi += 0.12;
            if (['+','=','-'].includes(event.key)) {
                const factor = event.key === '-' ? 1.1 : 0.9;
                if (camera instanceof OrthographicCamera) camera.zoom = Math.max(0.05, Math.min(100, camera.zoom / factor));
                else spherical.radius = Math.max(controls?.minDistance ?? 0.1, Math.min(controls?.maxDistance ?? 1000, spherical.radius * factor));
            }
            spherical.makeSafe(); camera.position.copy(offset.setFromSpherical(spherical).add(target));
            camera.lookAt(target); camera.updateProjectionMatrix(); controls?.update(); invalidate();
        };
        canvas.addEventListener('keydown', keyDown);
        return () => { canvas.removeEventListener('keydown', keyDown); canvas.removeAttribute('tabindex'); };
    }, [gl, camera, invalidate, get, description]);
    return null;
}
