// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { setSceneMotion } from '../../hooks/useSceneMotion';
import MonteCarlo from './MonteCarlo';
import Distributions from './Distributions';

vi.mock('../../components/3d/SceneCanvas', () => ({ SceneCanvas: ({ fallback }: { fallback: ReactNode }) => <>{fallback}</> }));
vi.mock('../../components/3d/SpatialScene', () => ({ SpatialScene: ({ description }: { description: string }) => <div role="img" aria-label={description} /> }));
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); setSceneMotion(true); });
function show(id: string, Scene: typeof MonteCarlo) {
    render(<MemoryRouter initialEntries={[`/probability/${id}`]}><Routes><Route path="/:topicId/:subtopicId" element={<Scene />} /></Routes></MemoryRouter>);
}
const metric = (label: string) => [...document.querySelectorAll('.visual-lab-metrics > div')].find(e => e.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;

test('Monte Carlo same-seed restart reproduces the estimate and budget/count controls work without WebGL', () => {
    show('monte-carlo', MonteCarlo);
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.getByRole('img', { name: /Cube samples/ })).toBeDefined();
    expect(screen.getByRole('img', { name: /Absolute estimation error/ })).toBeDefined();
    fireEvent.change(screen.getByRole('slider', { name: 'Samples revealed' }), { target: { value: '500' } });
    const original = metric('π estimate');
    fireEvent.click(screen.getByRole('button', { name: 'Restart same seed' }));
    expect(metric('Samples')).toBe('0/500');
    fireEvent.change(screen.getByRole('slider', { name: 'Samples revealed' }), { target: { value: '500' } });
    expect(metric('π estimate')).toBe(original);
    fireEvent.click(screen.getByRole('button', { name: 'Run again: new seed' }));
    expect(document.querySelector('.visual-lab-header')?.textContent).toContain('seed 8');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sample budget' }), { target: { value: '10000' } });
    expect((screen.getByRole('slider', { name: 'Samples revealed' }) as HTMLInputElement).max).toBe('10000');
    expect(metric('Samples')).toBe('0/10000');
    fireEvent.change(screen.getByRole('slider', { name: 'Samples revealed' }), { target: { value: '10000' } });
    expect(metric('Samples')).toBe('10000/10000');
    const projection = screen.getByRole('img', { name: /Cube samples/ });
    expect(projection.querySelector('desc')?.textContent).toContain('10000 samples');
    expect(projection.querySelectorAll('circle,rect').length).toBeLessThanOrEqual(1200);
});
test('global pause stops Monte Carlo timer work while the manual lever still advances samples', () => {
    vi.useFakeTimers(); show('monte-carlo', MonteCarlo);
    const start = metric('Samples');
    fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }));
    act(() => { vi.advanceTimersByTime(125); });
    expect(metric('Samples')).not.toBe(start);
    fireEvent.click(screen.getByRole('button', { name: 'Pause motion' }));
    const paused = metric('Samples');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(metric('Samples')).toBe(paused);
    expect((screen.getByRole('button', { name: 'Play', exact: true }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add 7 samples' }));
    expect(metric('Samples')).not.toBe(paused);
});
test('Gaussian controls update peak and shape while its two-dimensional one-sigma probability remains explicit', () => {
    show('distributions', Distributions);
    expect(metric('Scaled peak')).toBe('2.000');
    fireEvent.change(screen.getByRole('slider', { name: 'Standard deviation σx' }), { target: { value: '1.8' } });
    expect(metric('Scaled peak')).toBe('1.111');
    fireEvent.change(screen.getByRole('slider', { name: 'Correlation ρ' }), { target: { value: '0.9' } });
    expect(Number(metric('Scaled peak'))).toBeGreaterThan(2);
    expect(metric('Theoretical fraction')).toBe('39.3%');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sample count N' }), { target: { value: '500' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Display' }), { target: { value: 'top' } });
    expect(screen.getByRole('img', { name: /Gaussian samples and one-sigma/ }).querySelector('desc')?.textContent).toContain('All 500');
    const before = metric('Sample mean (x, y)');
    fireEvent.click(screen.getByRole('button', { name: 'Resample', exact: true }));
    expect(metric('Sample mean (x, y)')).not.toBe(before);
});
