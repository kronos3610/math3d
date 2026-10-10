// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import GaussianMixture from './GaussianMixture';

// Omit the renderer entirely: EM must not depend on its animation callback.
vi.mock('../../components/3d/SceneCanvas', () => ({ SceneCanvas: () => <div role="img" aria-label="No renderer in this test" /> }));
afterEach(cleanup);
test('manual E/M updates finish and can repeat without any renderer or animation frames', () => {
    render(<MemoryRouter initialEntries={['/ml/gaussian-mixture']}><Routes><Route path="/:topicId/:subtopicId" element={<GaussianMixture />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    const e = screen.getByRole('button', { name: '1. E-Step' }) as HTMLButtonElement;
    const m = screen.getByRole('button', { name: '2. M-Step' }) as HTMLButtonElement;
    expect(e.disabled).toBe(false); expect(m.disabled).toBe(true);
    fireEvent.click(e); expect(m.disabled).toBe(false);
    fireEvent.click(m); expect(screen.getByText('Iteration 1')).toBeDefined(); expect(e.disabled).toBe(false);
    fireEvent.click(e); fireEvent.click(m);
    expect(screen.getByText('Iteration 2')).toBeDefined(); expect(e.disabled).toBe(false);
    expect(document.body.textContent).not.toContain('NaN');
    fireEvent.click(screen.getByRole('button', { name: 'Reset & Regenerate Data' }));
    expect(screen.getByText('Iteration 0')).toBeDefined(); expect(e.disabled).toBe(false);
});
