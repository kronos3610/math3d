// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import SceneMotionControl from '../components/SceneMotionControl';
import { useSceneMotion } from './useSceneMotion';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
test('OS reduced-motion preference pauses by default and explicit choices persist and synchronize', () => {
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => media);
    function State() { return <p>{useSceneMotion() ? 'Moving' : 'Still'}</p>; }
    render(<><SceneMotionControl /><State /></>);
    expect(screen.getByText('Still')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Resume motion' }));
    expect(screen.getByText('Moving')).toBeDefined();
    expect(localStorage.getItem('math3d-scene-motion')).toBe('on');
    act(() => { localStorage.setItem('math3d-scene-motion', 'off'); window.dispatchEvent(new Event('storage')); });
    expect(screen.getByText('Still')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Resume motion' }).getAttribute('aria-pressed')).toBe('true');
});
