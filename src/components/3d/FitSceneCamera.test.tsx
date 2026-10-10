// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { FitSceneCamera } from './FitSceneCamera';
import type { SceneBounds } from './camera-fit';

const mocked = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@react-three/fiber', () => ({ useThree: (selector?: (state: Record<string, unknown>) => unknown) => selector ? selector(mocked.current) : mocked.current }));
afterEach(cleanup);

test('fits and saves Reset state; ordinary re-renders preserve manual orbit, and resize preserves direction and target', () => {
    const bounds: SceneBounds = { minimum: [-4, -2, -4], maximum: [5.3, 5.3, 5.3] };
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000); camera.position.set(8, 6, 8);
    const target = new Vector3(); const invalidate = vi.fn(); let savedPosition = new Vector3();
    const controls = { target, update: vi.fn(), saveState: vi.fn(() => { savedPosition = camera.position.clone(); }) };
    mocked.current = { camera, size: { width: 390, height: 700 }, controls, invalidate };
    const { rerender } = render(<FitSceneCamera bounds={bounds} />);
    expect(camera.aspect).toBe(390 / 700); expect(camera.position.length()).toBeGreaterThan(Math.hypot(8, 6, 8));
    expect(savedPosition.equals(camera.position)).toBe(true); expect(invalidate).toHaveBeenCalledOnce();
    camera.position.set(14, 9, 11); target.set(2, 1, -1);
    const manual = camera.position.clone(); const direction = manual.clone().sub(target).normalize();
    // A new bounds object with identical values, as in a model-control render, must not reset the camera.
    rerender(<FitSceneCamera bounds={{ minimum: [...bounds.minimum], maximum: [...bounds.maximum] }} />);
    expect(camera.position.equals(manual)).toBe(true); expect(invalidate).toHaveBeenCalledOnce();
    mocked.current.size = { width: 1180, height: 835 };
    rerender(<FitSceneCamera bounds={bounds} />);
    expect(camera.position.clone().sub(target).normalize().distanceTo(direction)).toBeLessThan(1e-12);
    expect(target.toArray()).toEqual([2, 1, -1]); expect(invalidate).toHaveBeenCalledTimes(2);
    expect(savedPosition.equals(camera.position)).toBe(true);
});
