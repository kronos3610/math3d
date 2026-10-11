import { SceneKey, type KeyEntry } from './SceneKey';
export type AxisKeyEntry = KeyEntry;
export function SceneAxisKey({ axes }: { axes: readonly AxisKeyEntry[] }) {
    return <SceneKey entries={axes} />;
}
