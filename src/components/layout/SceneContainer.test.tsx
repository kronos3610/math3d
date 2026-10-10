// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { SceneContainer } from './SceneContainer';

afterEach(cleanup);

test('scene tabs support keyboard navigation and expose the selected panel', () => {
    render(<MemoryRouter><SceneContainer controls={<p>Settings</p>} explanation={<p>Explanation text</p>}>
        <div>Scene</div>
    </SceneContainer></MemoryRouter>);
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
