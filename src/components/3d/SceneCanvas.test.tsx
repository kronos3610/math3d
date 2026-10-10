// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SceneCanvas } from './SceneCanvas';
import GraphicsQualityControl from '../GraphicsQualityControl';
import { setGraphicsQuality } from '../../hooks/useGraphicsQuality';

const state = vi.hoisted(() => ({ props: {} as Record<string, unknown>, mounts: 0 }));
vi.mock('@react-three/fiber', () => ({ Canvas: (props: Record<string, unknown>) => { state.props = props; state.mounts++; return <div data-testid="supported-canvas" />; } }));
const loseContext = vi.fn();
const getExtension = vi.fn(() => ({ loseContext }));

beforeEach(() => {
    localStorage.clear(); setGraphicsQuality('light');
    state.props = {}; state.mounts = 0;
    loseContext.mockClear(); getExtension.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension } as unknown as WebGL2RenderingContext);
});
afterEach(() => { cleanup(); localStorage.clear(); setGraphicsQuality('light'); vi.restoreAllMocks(); });

test('unsupported WebGL2 shows readable recovery without mounting the renderer', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    render(<SceneCanvas frameloop="demand" />);
    expect(screen.getByRole('heading', { name: '3D rendering is unavailable' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('lesson guide and controls are still available');
    expect(screen.queryByTestId('supported-canvas')).toBeNull();
    expect(state.mounts).toBe(0);
});

test('a failed capability probe also exposes recovery and honors a custom fallback', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => { throw new Error('Graphics initialization denied'); });
    render(<SceneCanvas fallback={<p role="status">Read this lesson without 3D.</p>} />);
    expect(screen.getByRole('status').textContent).toBe('Read this lesson without 3D.');
    expect(state.mounts).toBe(0);
});

test('an explicit empty fallback keeps unsupported decorative graphics out of the page', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const { container } = render(<SceneCanvas fallback={null} aria-hidden="true" />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('status')).toBeNull();
});

test('supported WebGL2 releases the disposable probe context before rendering the scene', () => {
    render(<SceneCanvas />);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('webgl2', { antialias: false, powerPreference: 'low-power' });
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('supported-canvas')).toBeDefined();
    expect(state.props.gl).toEqual({ antialias: false, powerPreference: 'low-power' });
});

test('missing optional context-release extension does not hide a supported scene', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({ getExtension: () => null } as unknown as WebGL2RenderingContext);
    render(<SceneCanvas />);
    expect(screen.getByTestId('supported-canvas')).toBeDefined();
});

test('light mode caps pixels and disables expensive shadows while preserving scene behavior', () => {
    render(<SceneCanvas dpr={[1, 2]} shadows frameloop="demand" camera={{ position: [1, 2, 3] }} />);
    expect(state.props.dpr).toBe(1);
    expect(state.props.shadows).toBe(false);
    expect(state.props.frameloop).toBe('demand');
    expect(state.props.camera).toEqual({ position: [1, 2, 3] });
});

test('labeled graphics selection updates the renderer and persists the setting', () => {
    render(<><GraphicsQualityControl /><SceneCanvas dpr={[1, 1.5]} shadows /></>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Graphics quality' }), { target: { value: 'detailed' } });
    expect(state.props.dpr).toEqual([1, 1.5]);
    expect(state.props.shadows).toBe(true);
    expect(localStorage.getItem('math3d-graphics-quality')).toBe('detailed');
    fireEvent.change(screen.getByRole('combobox', { name: 'Graphics quality' }), { target: { value: 'light' } });
    expect(state.props.dpr).toBe(1);
    expect(state.props.shadows).toBe(false);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(1);
});
