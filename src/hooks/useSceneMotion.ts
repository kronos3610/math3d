import { useSyncExternalStore } from 'react';

const storageKey = 'math3d-scene-motion';
const query = '(prefers-reduced-motion: reduce)';
const listeners = new Set<() => void>();
let memoryPreference: boolean | undefined;

function snapshot() {
    if (typeof window === 'undefined') return true;
    try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved === 'on' || saved === 'off') return saved === 'on';
    } catch { /* Motion can still be controlled without browser storage. */ }
    return memoryPreference ?? !window.matchMedia?.(query)?.matches;
}
function subscribe(listener: () => void) {
    listeners.add(listener);
    if (typeof window === 'undefined') return () => { listeners.delete(listener); };
    const media = window.matchMedia?.(query);
    media?.addEventListener?.('change', listener);
    window.addEventListener?.('storage', listener);
    return () => {
        listeners.delete(listener); media?.removeEventListener?.('change', listener);
        window.removeEventListener?.('storage', listener);
    };
}
export function setSceneMotion(enabled: boolean) {
    memoryPreference = enabled;
    try { window.localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch { /* Memory fallback. */ }
    listeners.forEach(listener => listener());
}
export function useSceneMotion() {
    return useSyncExternalStore(subscribe, snapshot, () => true);
}
