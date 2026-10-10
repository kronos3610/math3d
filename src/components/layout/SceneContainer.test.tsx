// @vitest-environment jsdom
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SceneContainer } from './SceneContainer';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('scene tabs support keyboard navigation and expose the selected panel', () => {
    render(<MemoryRouter><SceneContainer controls={<p>Settings</p>} explanation={<p>Explanation text</p>}>
        <div>Scene</div>
    </SceneContainer></MemoryRouter>);
    expect(screen.queryByRole('tab')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    const controls = screen.getByRole('tab', { name: 'Controls' });
    controls.focus();
    fireEvent.keyDown(controls, { key: 'ArrowRight' });
    const explain = screen.getByRole('tab', { name: 'Explain' });
    expect(document.activeElement).toBe(explain);
    expect(explain.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Explain' }).textContent).toBe('Explanation text');
    fireEvent.keyDown(explain, { key: 'Home' });
    expect(document.activeElement).toBe(controls);
    fireEvent.click(screen.getByRole('button', { name: 'Close scene panel' }));
    expect(screen.queryByRole('tabpanel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByRole('tabpanel', { name: 'Controls' })).toBeDefined();
});


test('following a learning path opens Learn and keeps the sequence when advancing', () => {
    render(<MemoryRouter initialEntries={['/ml/signal-to-noise?path=generalization']}>
        <Routes><Route path="/:topicId/:subtopicId" element={
            <SceneContainer controls={<p>Settings</p>} defaultPanel="closed"><div>Scene</div></SceneContainer>
        } /></Routes>
    </MemoryRouter>);
    expect(screen.getByRole('tab', { name: 'Learn' }).getAttribute('aria-selected')).toBe('true');
    const navigation = screen.getByRole('navigation', { name: 'Previous and next lessons' });
    const nextLink = navigation.querySelector<HTMLAnchorElement>('a[href="/ml/bias-variance?path=generalization"]');
    expect(nextLink).not.toBeNull();
    fireEvent.click(nextLink!);
    expect(screen.getByText('Lesson 3 of 5')).toBeDefined();
    expect((screen.getByRole('combobox', { name: 'Follow a learning path' }) as HTMLSelectElement).value).toBe('generalization');
});

test('invalid learning path does not open a lab drawer', () => {
    render(<MemoryRouter initialEntries={['/ml/bias-variance?path=unknown']}>
        <Routes><Route path="/:topicId/:subtopicId" element={
            <SceneContainer explanation={<p>Explanation</p>} defaultPanel="closed"><div>Scene</div></SceneContainer>
        } /></Routes>
    </MemoryRouter>);
    expect(screen.queryByRole('tab')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByRole('tab', { name: 'Learn' })).toBeDefined();
});

test('a mobile learning path retains its navigation while opening on the visible experiment', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 768px)', addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<MemoryRouter initialEntries={['/ml/signal-to-noise?path=generalization']}><Routes>
        <Route path="/:topicId/:subtopicId" element={<SceneContainer defaultPanel="closed" explanation={<p>Detail</p>}><p>Visible experiment</p></SceneContainer>} />
    </Routes></MemoryRouter>);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('Visible experiment')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByRole('tab', { name: 'Learn' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('navigation', { name: 'Previous and next lessons' })).toBeDefined();
    fireEvent.keyDown(screen.getByRole('tabpanel'), { key: 'Escape' });
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open scene panel' }));
});

test('a lesson shows a brief before its controls and exposes its complete guide by keyboard', () => {
    render(<MemoryRouter initialEntries={['/linear-algebra/vector-operations']}>
        <Routes><Route path="/:topicId/:subtopicId" element={
            <SceneContainer controls={<label>Example setting<input type="range" /></label>}><div>Scene</div></SceneContainer>
        } /></Routes>
    </MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Vector Operations' })).toBeDefined();
    expect(screen.queryByRole('slider')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getAllByText(/Vector addition combines two displacements/)).toHaveLength(2);
    expect(screen.getByRole('slider', { name: 'Example setting' })).toBeDefined();
    const controls = screen.getByRole('tab', { name: 'Controls' });
    controls.focus();
    fireEvent.keyDown(controls, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Guide' }));
    expect(screen.getByRole('heading', { name: 'How to use it' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Graphics quality' })).toBeDefined();
});
