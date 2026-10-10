// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import App from '../App';

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });
test('an address outside the lesson route structure gives a usable recovery page', () => {
    window.history.replaceState({}, '', '/unknown/deep/address');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Lesson not found' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Explore topics' }).getAttribute('href')).toBe('/');
});
