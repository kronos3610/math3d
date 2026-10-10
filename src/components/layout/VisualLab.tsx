import { useEffect, useId, useState, type ReactNode } from 'react';
import { SceneContainer } from './SceneContainer';

export interface LabMetric { label: string; value: string | number; }
interface VisualLabProps {
    title: string;
    subtitle?: string;
    controls: ReactNode;
    metrics?: readonly LabMetric[];
    insight: ReactNode;
    explanation: ReactNode;
    children: ReactNode;
    challenge?: string;
}

/** A visual experiment keeps its controls close and its longer lesson optional. */
export function VisualLab({ title, subtitle, controls, metrics = [], insight, explanation, children, challenge }: VisualLabProps) {
    const id = useId();
    return <SceneContainer backUrl="/ml" defaultPanel="closed" explanation={explanation}>
        <section className="visual-lab" aria-labelledby={`${id}-title`}>
            <header className="visual-lab-header">
                <div><h1 id={`${id}-title`}>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
                {metrics.length > 0 && <dl className="visual-lab-metrics" aria-label={`${title} measurements`}>
                    {metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
                </dl>}
            </header>
            <div className="visual-lab-stage">{children}</div>
            <div className="visual-lab-console">
                <div className="visual-lab-controls">{controls}</div>
                <p className="visual-lab-insight" aria-live="polite">{insight}</p>
                {challenge && <p className="visual-lab-challenge"><strong>Try:</strong> {challenge}</p>}
                <p className="visual-lab-panel-hint">In 3D, drag to rotate and scroll or pinch to zoom; focus the view to use arrow keys and +/−. Open the scene panel for Guide, Explain, and connected lessons.</p>
            </div>
        </section>
    </SceneContainer>;
}

interface LabRangeProps {
    label: string; value: number; min: number; max: number; step?: number;
    decimals?: number; onChange: (value: number) => void;
}
export function LabRange({ label, value, min, max, step = 1, decimals = 0, onChange }: LabRangeProps) {
    const id = useId();
    return <div className="visual-lab-field">
        <label htmlFor={id}><span>{label}</span><output htmlFor={id}>{value.toFixed(decimals)}</output></label>
        <input id={id} type="range" value={value} min={min} max={max} step={step}
            aria-label={label} aria-valuetext={value.toFixed(decimals)} onChange={event => onChange(Number(event.target.value))} />
    </div>;
}

interface LabSelectProps {
    label: string; value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
}
export function LabSelect({ label, value, options, onChange }: LabSelectProps) {
    const id = useId();
    return <div className="visual-lab-field">
        <label htmlFor={id}>{label}</label>
        <select id={id} value={value} onChange={event => onChange(event.target.value)}>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
    </div>;
}

interface LabPlaybackProps { step: number; max: number; onStep: (step: number) => void; onReset?: () => void; interval?: number; }
export function LabPlayback({ step, max, onStep, onReset, interval = 850 }: LabPlaybackProps) {
    const [playing, setPlaying] = useState(false);
    const active = playing && step < max;
    useEffect(() => {
        if (!active) return;
        const timer = window.setTimeout(() => onStep(Math.min(max, step + 1)), interval);
        return () => window.clearTimeout(timer);
    }, [active, step, max, onStep, interval]);
    return <div className="visual-lab-playback" role="group" aria-label="Experiment playback">
        <button type="button" className="lab-button" disabled={step >= max} onClick={() => { setPlaying(false); onStep(Math.min(max, step + 1)); }}>Step</button>
        <button type="button" className="lab-button" aria-pressed={active} onClick={() => {
            if (active) setPlaying(false);
            else { if (step >= max) onStep(0); setPlaying(true); }
        }}>{active ? 'Pause' : 'Play'}</button>
        <button type="button" className="lab-button" onClick={() => { setPlaying(false); onStep(0); onReset?.(); }}>Reset</button>
        <span aria-live="polite">Step {step} / {max}</span>
    </div>;
}
