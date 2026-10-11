// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import LinearDiscriminants from './LinearDiscriminants';

let width = 390;
let height = 300;
let resized: ResizeObserverCallback | undefined;
const arc = vi.fn<(x: number, y: number, radius: number, start: number, end: number) => void>();
const context: Partial<CanvasRenderingContext2D> = {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
    setLineDash: vi.fn(), arc, fillText: vi.fn(),
};

beforeEach(() => {
    width = 390; height = 300; resized = undefined; arc.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(10, 20, width, height));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => kind === '2d' ? context as CanvasRenderingContext2D : null);
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: ResizeObserverCallback) { resized = callback; }
        observe() { /* sized rectangle comes from the DOM mock */ }
        disconnect() { /* no native observer to disconnect */ }
    });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function show() {
    render(<MemoryRouter initialEntries={['/ml/linear-discriminants']}><Routes><Route path="/:topicId/:subtopicId" element={<LinearDiscriminants />} /></Routes></MemoryRouter>);
    return screen.getByRole('img', { name: /Linear discriminant boundary/ });
}
function point() {
    const latest = arc.mock.calls.filter(call => call[2] === 9).at(-1);
    if (!latest) throw new Error('No test point was drawn');
    return latest.slice(0, 2);
}

test('repeated mobile keyboard moves keep the point visible and the score uses the clamped pixel coordinates', () => {
    const canvas = show();
    for (let index = 0; index < 40; index++) fireEvent.keyDown(canvas, { key: 'ArrowRight', shiftKey: true });
    for (let index = 0; index < 40; index++) fireEvent.keyDown(canvas, { key: 'ArrowUp', shiftKey: true });
    expect(point()).toEqual([167, -122]);
    const expectedScore = 80 * Math.SQRT1_2 * (167 + 122) - 3200;
    expect(screen.getByText(expectedScore.toFixed(0))).toBeDefined();
    expect(screen.getByText((expectedScore / 80).toFixed(2))).toBeDefined();
    for (let index = 0; index < 40; index++) fireEvent.keyDown(canvas, { key: 'ArrowLeft', shiftKey: true });
    for (let index = 0; index < 40; index++) fireEvent.keyDown(canvas, { key: 'ArrowDown', shiftKey: true });
    expect(point()).toEqual([-167, 122]);
    fireEvent.click(screen.getByRole('button', { name: 'Reset point' }));
    expect(point()).toEqual([80, -60]);
});

test('pointer drags outside the canvas clamp to its edge and resizing brings the point into the new interior', () => {
    const canvas = show();
    fireEvent.mouseDown(canvas, { clientX: 10 + width / 2 + 80, clientY: 20 + height / 2 - 60 });
    fireEvent.mouseMove(window, { clientX: 2000, clientY: -1000 });
    fireEvent.mouseUp(window);
    expect(point()).toEqual([167, -122]);
    width = 200; height = 160;
    act(() => resized?.([], {} as ResizeObserver));
    expect(point()).toEqual([72, -52]);
    fireEvent.click(screen.getByRole('button', { name: 'Reset point' }));
    expect(point()).toEqual([72, -52]);
});

test('touch drag is bounded and touch cancellation ends dragging', () => {
    const canvas = show();
    fireEvent.touchStart(canvas, { touches: [{ clientX: 10 + width / 2 + 80, clientY: 20 + height / 2 - 60 }] });
    fireEvent.touchMove(canvas, { touches: [{ clientX: -1000, clientY: 1000 }] });
    expect(point()).toEqual([-167, 122]);
    fireEvent.touchCancel(canvas);
    fireEvent.touchMove(canvas, { touches: [{ clientX: 1000, clientY: -1000 }] });
    expect(point()).toEqual([-167, 122]);
});
