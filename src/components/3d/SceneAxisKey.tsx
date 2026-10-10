export interface AxisKeyEntry { label: string; meaning: string; color: string; }
export function SceneAxisKey({ axes }: { axes: readonly AxisKeyEntry[] }) {
    return <ul className="scene-axis-key" aria-label="Plot axis meanings">{axes.map(axis => <li key={axis.label}><span aria-hidden="true" style={{ background: axis.color }} /><strong>{axis.label}</strong>: {axis.meaning}</li>)}</ul>;
}
