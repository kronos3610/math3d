// @vitest-environment jsdom
import { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { lazyWithMode, lazyWithPreload } from './lazy';
import SceneErrorBoundary from '../components/SceneErrorBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('a failed speculative import can be retried by the real visit', async () => {
    const factory = vi.fn<() => Promise<{ default: () => React.ReactNode }>>()
        .mockRejectedValueOnce(new Error('Temporary network failure'))
        .mockResolvedValue({ default: () => <p>Working scene</p> });
    const Scene = lazyWithPreload(factory);
    await expect(Scene.preload()).rejects.toThrow('Temporary network failure');
    render(<Suspense fallback={<p>Loading</p>}><Scene /></Suspense>);
    expect(await screen.findByText('Working scene')).toBeDefined();
    expect(factory).toHaveBeenCalledTimes(2);
});

test('successful preloads share the same import with subsequent renders', async () => {
    const factory = vi.fn(async () => ({ default: () => <p>Loaded once</p> }));
    const Scene = lazyWithPreload(factory);
    await Promise.all([Scene.preload(), Scene.preload()]);
    render(<Suspense fallback={null}><Scene /></Suspense>);
    expect(await screen.findByText('Loaded once')).toBeDefined();
    expect(factory).toHaveBeenCalledTimes(1);
});

test('mode wrappers also retry a failed preload and retain the requested lesson', async () => {
    const factory = vi.fn<() => Promise<{ default: React.ComponentType<{ mode?: 'tree' | 'forest' }> }>>()
        .mockRejectedValueOnce(new Error('Offline'))
        .mockResolvedValue({ default: ({ mode }) => <p>{mode}</p> });
    const Scene = lazyWithMode(factory, 'forest');
    await expect(Scene.preload()).rejects.toThrow();
    render(<Suspense fallback={null}><Scene /></Suspense>);
    expect(await screen.findByText('forest')).toBeDefined();
});

test('a real import failure remains visible through the lesson boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Scene = lazyWithPreload(async () => { throw new Error('Unavailable chunk'); });
    render(<SceneErrorBoundary fallback={<p>Read the guide and reload</p>}><Suspense fallback={null}><Scene /></Suspense></SceneErrorBoundary>);
    expect(await screen.findByText('Read the guide and reload')).toBeDefined();
});
