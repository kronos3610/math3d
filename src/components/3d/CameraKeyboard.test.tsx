// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { CameraKeyboard } from './CameraKeyboard';
import { setSceneMotion } from '../../hooks/useSceneMotion';

const mocked = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@react-three/fiber', () => ({ useThree: (selector?: (state: Record<string, unknown>) => unknown) => selector ? selector(mocked.current) : mocked.current }));
const invalidate = vi.fn(); const update = vi.fn();
let canvas: HTMLCanvasElement;
let camera: PerspectiveCamera;
beforeEach(() => {
    localStorage.clear(); setSceneMotion(true); invalidate.mockClear(); update.mockClear();
    canvas = document.createElement('canvas');
    camera = new PerspectiveCamera(); camera.position.set(8, 4, 10);
    mocked.current = { gl: { domElement: canvas }, camera, invalidate,
        controls: { target: new Vector3(2, 1, 0), update, autoRotate: true, minDistance: 1, maxDistance: 30 }, get: () => mocked.current };
});
afterEach(() => { cleanup(); localStorage.clear(); setSceneMotion(true); });
test('the actual canvas is named and keyboard rotation preserves distance to the control target', () => {
    const { unmount } = render(<CameraKeyboard description="A transformed cube" />);
    expect(canvas.tabIndex).toBe(0); expect(canvas.getAttribute('aria-label')).toContain('A transformed cube');
    const target = new Vector3(2, 1, 0); const before = camera.position.clone(); const distance = before.distanceTo(target);
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(camera.position.equals(before)).toBe(false);
    expect(camera.position.distanceTo(target)).toBeCloseTo(distance, 10);
    expect(update).toHaveBeenCalled(); expect(invalidate).toHaveBeenCalled();
    fireEvent.keyDown(canvas, { key: '+' });
    expect(camera.position.distanceTo(target)).toBeCloseTo(distance * 0.9, 10);
    unmount(); const after = camera.position.clone();
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' }); expect(camera.position.equals(after)).toBe(true);
});
test('keyboard zoom changes orthographic projection rather than an ineffective camera distance', () => {
    const orthographic = new OrthographicCamera(-10, 10, 10, -10); orthographic.position.copy(camera.position);
    mocked.current.camera = orthographic;
    render(<CameraKeyboard description="Probability population" />);
    fireEvent.keyDown(canvas, { key: '+' }); expect(orthographic.zoom).toBeCloseTo(1 / 0.9);
    fireEvent.keyDown(canvas, { key: '-' }); expect(orthographic.zoom).toBeCloseTo(1 / 0.99);
});
test('pausing motion stops automatic orbit while retaining manual keyboard camera controls', () => {
    setSceneMotion(false);
    render(<CameraKeyboard description="A still experiment" />);
    const controls = mocked.current.controls as { autoRotate: boolean };
    expect(controls.autoRotate).toBe(false);
    const before = camera.position.clone(); fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    expect(camera.position.equals(before)).toBe(false);
});
