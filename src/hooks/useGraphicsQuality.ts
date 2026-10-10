import { useSyncExternalStore } from 'react';

export type GraphicsQuality = 'light' | 'detailed';
const storageKey = 'math3d-graphics-quality';
const listeners = new Set<() => void>();
let memoryQuality: GraphicsQuality = 'light';

function getQuality(): GraphicsQuality {
    if (typeof window === 'undefined') return 'light';
    try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved === 'light' || saved === 'detailed') return saved;
    } catch { /* The in-memory setting also works when storage is unavailable. */ }
    return memoryQuality;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener('storage', listener);
    return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
}

export function setGraphicsQuality(quality: GraphicsQuality) {
    memoryQuality = quality;
    try { window.localStorage.setItem(storageKey, quality); } catch { /* Memory fallback. */ }
    listeners.forEach(listener => listener());
}

export function useGraphicsQuality() {
    return useSyncExternalStore(subscribe, getQuality, () => 'light' as const);
}
