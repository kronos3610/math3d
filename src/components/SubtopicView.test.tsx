// @vitest-environment jsdom
import { lazy } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import SubtopicView from './SubtopicView';
import { getSubtopicById } from '../data/topics';

// Only replace the scene loader; route metadata and guides remain real.
vi.mock('../data/topics', async importOriginal => {
    const original = await importOriginal<typeof import('../data/topics')>();
    return { ...original, getSubtopicById: vi.fn(original.getSubtopicById) };
});

function renderScene() {
    return render(<MemoryRouter initialEntries={['/linear-algebra/vector-operations']}>
        <Routes><Route path="/:topicId/:subtopicId" element={<SubtopicView />} /></Routes>
    </MemoryRouter>);
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.mocked(getSubtopicById).mockReset(); });

test('a suspended scene still shows its meaning and usage and offers recovery after a delay', async () => {
    vi.useFakeTimers();
    const pending = Object.assign(lazy(() => new Promise<{ default: () => null }>(() => {})), { preload: vi.fn() });
    vi.mocked(getSubtopicById).mockReturnValue({ id: 'vector-operations', title: 'Vector Operations', description: 'Add vectors.', component: pending });
    renderScene();
    expect(screen.getByRole('heading', { name: 'What this shows' })).toBeDefined();
    expect(screen.getByText(/Vector addition combines two displacements/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Reload visualization' })).toBeNull();
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(screen.getByText(/taking longer than expected/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reload visualization' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to topic' }).getAttribute('href')).toBe('/linear-algebra');
});

test('a rejected scene loader has a readable recovery screen instead of a blank app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = Object.assign(lazy(() => Promise.reject(new Error('Scene import failed'))), { preload: vi.fn() });
    vi.mocked(getSubtopicById).mockReturnValue({ id: 'vector-operations', title: 'Vector Operations', description: 'Add vectors.', component: broken });
    renderScene();
    expect(await screen.findByText('This visualization could not start.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'How to use it' })).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Graphics quality' }), { target: { value: 'light' } });
    expect(screen.getByRole('button', { name: 'Reload visualization' })).toBeDefined();
});
