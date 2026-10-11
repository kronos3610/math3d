// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import GradientDescent from './GradientDescent';
import Derivatives from './Derivatives';
import Integrals from './Integrals';
import RiemannVsLebesgue from './RiemannVsLebesgue';
import { setSceneMotion } from '../../hooks/useSceneMotion';

// Keep native plots/fallbacks and the real lab chrome/CPU calculations.
vi.mock('../../components/3d/SceneCanvas', () => ({
    SceneCanvas: ({ fallback }: { fallback?: ReactNode }) => <>{fallback}</>,
}));
afterEach(() => { cleanup(); vi.useRealTimers(); window.localStorage.clear(); setSceneMotion(true); });

function renderLesson(id: string, Scene: typeof GradientDescent) {
    return render(<MemoryRouter initialEntries={[`/calculus/${id}`]}><Routes><Route path="/:topicId/:subtopicId" element={<Scene />} /></Routes></MemoryRouter>);
}
test('learning rate and start controls change actual descent steps, with a skippable state-derived prediction', () => {
    renderLesson('gradient-descent-calc', GradientDescent);
    const metrics = screen.getByText('Loss f').parentElement!;
    expect(metrics.textContent).toContain('6.5000');
    expect(screen.getByRole('list', { name: 'Plot key' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Just right (η=1)' }));
    expect((screen.getByRole('slider', { name: 'Learning rate' }) as HTMLInputElement).value).toBe('1');
    fireEvent.click(screen.getByRole('radio', { name: 'Reach the minimum in one update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(screen.getByText(/Your prediction matches/)).toBeDefined();
    expect(metrics.textContent).toContain('0.0000');
    expect(screen.getByText('Position (x, y)').nextElementSibling?.textContent).toBe('(0.000, 0.000)');
    fireEvent.click(screen.getByRole('button', { name: 'Diverges' }));
    expect(screen.getByRole('button', { name: 'Skip prediction' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Skip prediction' }));
    expect(screen.getByText('Position (x, y)').nextElementSibling?.textContent).toBe('(-3.600, -2.400)');
    fireEvent.change(screen.getByRole('slider', { name: 'Start x' }), { target: { value: '-2' } });
    expect(screen.getByText('Position (x, y)').nextElementSibling?.textContent).toBe('(-2.000, 2.000)');
    expect(screen.getByRole('img', { name: /Quadratic loss bowl/ })).toBeDefined();
});

test('Replay respects global pause while manual Step remains usable', () => {
    vi.useFakeTimers(); setSceneMotion(false);
    renderLesson('gradient-descent-calc', GradientDescent);
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText('Position (x, y)').nextElementSibling?.textContent).toBe('(3.000, 2.000)');
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    expect(screen.getByText('Position (x, y)').nextElementSibling?.textContent).toBe('(2.700, 1.800)');
    fireEvent.click(screen.getByRole('button', { name: 'Resume motion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText('Position (x, y)').nextElementSibling?.textContent).toBe('(2.700, 1.800)');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText('Position (x, y)').nextElementSibling?.textContent).toBe('(2.700, 1.800)');
});

test('the derivative secant readout and fallback curve change with the direct h and slice levers', () => {
    renderLesson('derivatives', Derivatives);
    const before = Number(screen.getByText('Slope difference').nextElementSibling?.textContent);
    expect((screen.getByRole('checkbox', { name: 'Trace automatically' }) as HTMLInputElement).checked).toBe(false);
    fireEvent.change(screen.getByRole('slider', { name: 'Secant step h' }), { target: { value: '0.01' } });
    const after = Number(screen.getByText('Slope difference').nextElementSibling?.textContent);
    expect(Math.abs(after)).toBeLessThan(Math.abs(before));
    const first = screen.getByText('Tangent slope ∂f/∂x').nextElementSibling?.textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'Slice y' }), { target: { value: '1.5' } });
    expect(screen.getByText('Tangent slope ∂f/∂x').nextElementSibling?.textContent).not.toBe(first);
    expect(screen.getByRole('img', { name: /fixed slice y=1.50/ })).toBeDefined();
});

test('accumulation endpoint updates both linked plots, signed totals and slope readouts without WebGL', () => {
    renderLesson('integrals', Integrals);
    expect(screen.getByText('A(x) exact').nextElementSibling?.textContent).toBe('1.0000');
    expect(screen.getByText('f(x)').nextElementSibling?.textContent).toBe('1.0000');
    fireEvent.click(screen.getByRole('button', { name: 'x=π' }));
    expect(screen.getByText('A(x) exact').nextElementSibling?.textContent).toBe('2.0000');
    fireEvent.click(screen.getByRole('button', { name: 'x=2π' }));
    expect(screen.getByText('A(x) exact').nextElementSibling?.textContent).toBe('0.0000');
    expect(screen.getByText('f(x)').nextElementSibling?.textContent).toBe('0.0000');
    expect(screen.getByText('A′(x) finite difference').nextElementSibling?.textContent).toBe('0.0000');
    expect(screen.getByRole('img', { name: /Function and linked accumulation/ })).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show midpoint bars' }));
    expect(screen.getByRole('slider', { name: 'Bars n' })).toBeDefined();
});

test('partition refinement changes both estimates while the selected direction changes a full-floor native view', () => {
    renderLesson('riemann-vs-lebesgue', RiemannVsLebesgue);
    const initial = screen.getByText('Lebesgue Σ').nextElementSibling?.textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'Refinement' }), { target: { value: '24' } });
    expect(screen.getByText('Lebesgue Σ').nextElementSibling?.textContent).not.toBe(initial);
    fireEvent.change(screen.getByRole('combobox', { name: 'Slice direction' }), { target: { value: 'lebesgue' } });
    expect(screen.getByRole('img', { name: /Lower layer heights.*full input floor/ })).toBeDefined();
    expect(screen.getByText(/lower height sum on a fixed 40×40 floor grid/)).toBeDefined();
    expect(screen.getByText('Fine-grid reference')).toBeDefined();
    expect(screen.getByRole('list', { name: 'Plot key' })).toBeDefined();
});
