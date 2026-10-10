import { useFrame, type RenderCallback } from '@react-three/fiber';
import { useSceneMotion } from './useSceneMotion';

/** Keep manual camera/control changes available while automatic motion is paused. */
export function useSceneFrame(callback: RenderCallback) {
    const moving = useSceneMotion();
    useFrame((state, delta, frame) => { if (moving) callback(state, delta, frame); });
}
