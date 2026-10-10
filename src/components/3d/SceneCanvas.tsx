import { Canvas, type CanvasProps } from '@react-three/fiber';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGraphicsQuality } from '../../hooks/useGraphicsQuality';
import { useSceneMotion } from '../../hooks/useSceneMotion';
import { getSubtopicById } from '../../data/topics';
import { CameraKeyboard } from './CameraKeyboard';

/** Three.js requires WebGL2; Canvas's fallback alone does not catch async startup failures. */
function supportsWebGL2(): boolean {
    if (typeof document === 'undefined') return false;
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl2', { antialias: false, powerPreference: 'low-power' });
        if (!context) return false;
        // This probe never draws or allocates scene resources. Release its GPU context
        // when the browser provides the extension instead of leaving a second context.
        try { context.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* Optional cleanup cannot determine support. */ }
        return true;
    } catch {
        return false;
    }
}

/** Keep pixel/shadow cost modest by default without changing the displayed math. */
export function SceneCanvas({ dpr, shadows, gl, fallback, children, frameloop, ...props }: CanvasProps) {
    const quality = useGraphicsQuality();
    const moving = useSceneMotion();
    const { topicId, subtopicId } = useParams();
    const lesson = topicId && subtopicId ? getSubtopicById(topicId, subtopicId) : undefined;
    const description = props['aria-label'] ?? (lesson ? `${lesson.title}. ${lesson.description}` : 'Interactive mathematical visualization.');
    const [webglAvailable] = useState(supportsWebGL2);
    const light = quality === 'light';
    const unavailable = fallback !== undefined ? fallback : <div className="scene-render-fallback" role="status">
        <h2>3D rendering is unavailable</h2>
        <p>This browser could not create a WebGL2 graphics context. The lesson guide and controls are still available. Try another browser or enable hardware acceleration.</p>
    </div>;
    if (!webglAvailable) return unavailable;
    return <Canvas
        {...props}
        aria-label={description}
        frameloop={moving ? (frameloop ?? 'demand') : 'demand'}
        dpr={light ? 1 : (dpr ?? [1, 1.5])}
        shadows={light ? false : shadows}
        gl={gl ?? { antialias: !light, powerPreference: 'low-power' }}
        fallback={unavailable}
    >{children}{props['aria-hidden'] !== true && props['aria-hidden'] !== 'true' && <CameraKeyboard description={description} />}</Canvas>;
}
