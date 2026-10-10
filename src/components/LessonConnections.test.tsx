// @vitest-environment jsdom
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import LessonConnections from './LessonConnections';
import TopicPage from './TopicPage';

// UI tests validate navigation without loading a scene or WebGL renderer.
vi.mock('../utils/lazy', () => ({
    lazyWithPreload: () => Object.assign(() => null, { preload: vi.fn() }),
}));

afterEach(cleanup);

function Location() {
    const location = useLocation();
    return <output aria-label="Current URL">{location.pathname}{location.search}</output>;
}

function renderLesson(url: string) {
    return render(<MemoryRouter initialEntries={[url]}>
        <Location />
        <Routes><Route path="/:topicId/:subtopicId" element={<LessonConnections />} /></Routes>
    </MemoryRouter>);
}

test('selected path renders adjacent canonical links and drops the path for unrelated concepts', () => {
    renderLesson('/ml/bias-variance?path=generalization');
    const navigation = screen.getByRole('navigation', { name: 'Previous and next lessons' });
    expect(within(navigation).getByRole('link', { name: /Signal-to-Noise Ratio/ }).getAttribute('href')).toBe('/ml/signal-to-noise?path=generalization');
    expect(within(navigation).getByRole('link', { name: /Ridge & Lasso Constraints/ }).getAttribute('href')).toBe('/ml/lagrange-constraints?path=generalization');
    expect(screen.getByRole('link', { name: /Neural Networks/ }).getAttribute('href')).toBe('/ml/neural-networks');
    expect(screen.getByText('Lesson 3 of 5')).toBeDefined();
});

test('native labeled path selector starts a path and permits leaving it', () => {
    renderLesson('/ml/bias-variance');
    const selector = screen.getByRole('combobox', { name: 'Follow a learning path' });
    selector.focus();
    expect(document.activeElement).toBe(selector);
    fireEvent.change(selector, { target: { value: 'generalization' } });
    expect(screen.getByLabelText('Current URL').textContent).toBe('/ml/bias-variance?path=generalization');
    fireEvent.change(selector, { target: { value: '' } });
    expect(screen.getByLabelText('Current URL').textContent).toBe('/ml/bias-variance');
    expect(screen.queryByRole('navigation', { name: 'Previous and next lessons' })).toBeNull();
});

test('a foundation shows reverse ML links; invalid path parameters do not fabricate progress', () => {
    renderLesson('/probability/distributions?path=network-optimization');
    expect(screen.queryByRole('navigation', { name: 'Previous and next lessons' })).toBeNull();
    const algorithms = screen.getByRole('region', { name: 'Use this in machine learning' });
    expect(within(algorithms).getByRole('link', { name: /Gaussian Mixture Models/ }).getAttribute('href')).toBe('/ml/gaussian-mixture');
});

test('ML section links filter canonical cards while other topic pages stay ungrouped', () => {
    render(<MemoryRouter initialEntries={['/ml?section=algorithms']}><Routes><Route path="/:topicId" element={<TopicPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Algorithms' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Core Concepts' })).toBeNull();
    const sections = screen.getByRole('navigation', { name: 'Machine learning sections' });
    fireEvent.click(within(sections).getByRole('link', { name: 'Core Concepts' }));
    expect(screen.queryByRole('region', { name: 'Algorithms' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Core Concepts' })).toBeDefined();
    expect(screen.getAllByText('Interactive experiment')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /Start path/ })).toHaveLength(4);
    cleanup();
    render(<MemoryRouter initialEntries={['/calculus']}><Routes><Route path="/:topicId" element={<TopicPage />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: 'Machine learning sections' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Derivatives' })).toBeDefined();
});
