import { useSceneMotion, setSceneMotion } from '../hooks/useSceneMotion';
import { Pause, Play } from 'lucide-react';

export default function SceneMotionControl() {
    const moving = useSceneMotion();
    return <button type="button" className="scene-motion-control" aria-pressed={!moving}
        aria-label={moving ? 'Pause motion' : 'Resume motion'} onClick={() => setSceneMotion(!moving)}>
        {moving ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        <span className="scene-motion-label">{moving ? 'Pause motion' : 'Resume motion'}</span>
    </button>;
}
