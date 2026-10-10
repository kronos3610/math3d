// @vitest-environment jsdom
import { useCallback, useState, useRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Sidebar from './Sidebar';

let mobile = true;
const listeners = new Set<() => void>();

beforeEach(() => {
    mobile = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
        get matches() { return mobile; },
        media: '(max-width: 768px)',
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    })));
});
afterEach(() => { cleanup(); listeners.clear(); vi.unstubAllGlobals(); });

function Navigation() {
    const openerRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    return <MemoryRouter>
        <button ref={openerRef} onClick={() => setOpen(true)}>Open navigation</button>
        <Sidebar isOpen={open} onClose={close} returnFocusRef={openerRef} />
    </MemoryRouter>;
}

test('closed mobile navigation is inert; opening traps focus and Escape restores it', () => {
    render(<Navigation />);
    const aside = document.getElementById('topic-navigation')!;
    expect(aside.hasAttribute('inert')).toBe(true);
    expect(aside.getAttribute('aria-hidden')).toBe('true');
    const opener = screen.getByRole('button', { name: 'Open navigation' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Topic navigation' });
    expect(dialog.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close sidebar' }));
    const links = dialog.querySelectorAll('a');
    links[links.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(links[links.length - 1]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aside.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(opener);
});

test('desktop navigation is available after resizing from closed mobile navigation', () => {
    render(<Navigation />);
    act(() => { mobile = false; listeners.forEach(listener => listener()); });
    const aside = document.getElementById('topic-navigation')!;
    expect(aside.hasAttribute('inert')).toBe(false);
    expect(aside.hasAttribute('aria-hidden')).toBe(false);
    expect(screen.getByRole('navigation', { name: 'Mathematics topics' })).toBeDefined();
});
