// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import RiemannIntegral from './RiemannIntegral';
import TaylorRemainder from './TaylorRemainder';
import RiemannVsLebesgue from './RiemannVsLebesgue';
import SigmaAlgebra from './SigmaAlgebra';

// Keep routing, SceneContainer, lesson metadata, Guide, and controls real; only
// omit the GPU surface and its graphics children in these DOM integration tests.
vi.mock('../../components/3d/SceneCanvas', () => ({
    SceneCanvas: (props: { 'aria-label'?: string }) => <div role="img" aria-label={props['aria-label']} />,
}));

afterEach(cleanup);

const lessons = [
    { id: 'riemann-integral', Scene: RiemannIntegral, meaning: /Riemann integration partitions the input domain/ },
    { id: 'taylor-remainder', Scene: TaylorRemainder, meaning: /A Taylor polynomial approximates a function near an expansion point/ },
    { id: 'riemann-vs-lebesgue', Scene: RiemannVsLebesgue, meaning: /Riemann sums group contributions by input location/ },
    { id: 'sigma-algebra', Scene: SigmaAlgebra, meaning: /A σ-algebra is a collection of measurable sets/ },
];

test.each(lessons)('$id exposes its real usage guide and graphics setting through the scene panel', ({ id, Scene, meaning }) => {
    render(<MemoryRouter initialEntries={[`/calculus/${id}`]}>
        <Routes><Route path="/:topicId/:subtopicId" element={<Scene />} /></Routes>
    </MemoryRouter>);
    const openPanel = screen.queryByRole('button', { name: 'Open scene panel' });
    if (openPanel) fireEvent.click(openPanel);
    const guideTab = screen.getByRole('tab', { name: 'Guide' });
    fireEvent.click(guideTab);
    expect(guideTab.getAttribute('aria-selected')).toBe('true');
    const panel = within(screen.getByRole('tabpanel', { name: 'Guide' }));
    expect(panel.getByRole('heading', { name: 'How to use it' })).toBeDefined();
    expect(panel.getByText(meaning)).toBeDefined();
    expect(panel.getByRole('combobox', { name: 'Graphics quality' })).toBeDefined();
});

test('switching from sine to logarithm resets an invalid expansion center and restricts its domain', () => {
    render(<MemoryRouter initialEntries={['/calculus/taylor-remainder']}>
        <Routes><Route path="/:topicId/:subtopicId" element={<TaylorRemainder />} /></Routes>
    </MemoryRouter>);
    const openPanel = screen.queryByRole('button', { name: 'Open scene panel' });
    if (openPanel) fireEvent.click(openPanel);
    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
    const center = screen.getByRole('slider', { name: 'Center' }) as HTMLInputElement;
    const functionSelector = screen.getByRole('combobox', { name: 'Function' }) as HTMLSelectElement;
    expect(functionSelector.value).toBe('sin');
    fireEvent.change(center, { target: { value: '-2' } });
    expect(center.value).toBe('-2');
    fireEvent.change(functionSelector, { target: { value: 'log' } });
    expect(functionSelector.value).toBe('log');
    expect(center.value).toBe('0');
    expect(center.min).toBe('-0.9');
});
