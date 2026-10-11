import { useId } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';

export interface KeyEntry { label: string; meaning: string; color: string; shape?: 'dot' | 'line' | 'square'; }
interface SceneKeyProps { entries: readonly KeyEntry[]; 'aria-label'?: string; inline?: boolean; }

/** Native disclosure on phones; the key never captures scene gestures outside its summary. */
export function SceneKey({ entries, 'aria-label': label = 'Plot axis meanings', inline = false }: SceneKeyProps) {
    const id = useId();
    const mobile = useIsMobile();
    if (!entries.length) return null;
    return <details open={!mobile} className={`scene-key ${inline ? 'scene-key-inline' : ''}`}>
        <summary aria-controls={id}>Key <span>{entries.map(entry => entry.label).join(' · ')}</span></summary>
        <ul id={id} className="scene-axis-key" aria-label={label}>{entries.map(entry => <li key={entry.label}>
            <span className={`scene-key-shape scene-key-${entry.shape ?? 'dot'}`} aria-hidden="true" style={{ background: entry.color }} />
            <strong>{entry.label}</strong>: {entry.meaning}
        </li>)}</ul>
    </details>;
}
