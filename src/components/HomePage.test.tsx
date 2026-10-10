// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import HomePage from './HomePage';

vi.mock('./HeroScene', () => ({ default: () => { throw new Error('Graphics failed'); } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('a broken decorative hero leaves the homepage and all topic links usable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Explore Topics' })).toBeDefined();
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
    for (const path of ['/linear-algebra','/calculus','/probability','/ml']) {
        expect(document.querySelector(`a[href="${path}"]`)).not.toBeNull();
    }
    expect(screen.getByRole('button', { name: 'Pause motion' })).toBeDefined();
});
