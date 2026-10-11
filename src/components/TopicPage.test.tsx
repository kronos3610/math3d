// @vitest-environment jsdom
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import TopicPage from './TopicPage';
import { getTopicLearningPaths } from '../data/mlCurriculum';
import { getTopicById } from '../data/topics';

vi.mock('../utils/lazy', () => ({
    lazyWithPreload: () => Object.assign(() => null, { preload: vi.fn() }),
    lazyWithMode: () => Object.assign(() => null, { preload: vi.fn() }),
}));

afterEach(cleanup);

function CurrentLocation() {
    const location = useLocation();
    return <output aria-label="Current URL">{location.pathname}{location.search}</output>;
}

function renderTopic(url = '/ml') {
    return render(<MemoryRouter initialEntries={[url]}>
        <CurrentLocation />
        <Routes><Route path="/:topicId" element={<TopicPage />} /></Routes>
    </MemoryRouter>);
}

test('the full curriculum has labeled search, complete family anchors, and learning paths', () => {
    const { container } = renderTopic();
    const search = screen.getByLabelText('Find a lesson') as HTMLInputElement;
    expect(search.type).toBe('search');
    search.focus();
    expect(document.activeElement).toBe(search);
    const count = getTopicById('ml')!.subtopics.length;
    const searchRegion = container.querySelector('.ml-lesson-search')!;
    expect(searchRegion.getAttribute('role')).toBe('search');
    expect(within(searchRegion as HTMLElement).getByRole('status').textContent).toBe(`${count} of ${count} lessons in this view.`);
    fireEvent.click(screen.getByText('Jump to a family'));
    const families = container.querySelector('.ml-family-jumps nav')!;
    expect(families.getAttribute('aria-label')).toBe('Machine learning families');
    for (const link of families.querySelectorAll('a')) {
        const heading = document.getElementById(link.getAttribute('href')!.slice(1));
        expect(heading?.tagName).toBe('H3');
        expect(heading?.getAttribute('tabindex')).toBe('-1');
    }
    expect(container.querySelectorAll('.ml-path-start')).toHaveLength(getTopicLearningPaths('ml').length);
});

test('search supports acronyms and independent words, updates URL, and leaves paths available', () => {
    renderTopic();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  HmM  ' } });
    expect(screen.getByRole('heading', { name: 'Hidden Markov Models' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Linear Regression' })).toBeNull();
    expect(within(screen.getByRole('search')).getByRole('status').textContent).toContain('1 of');
    expect(screen.getByLabelText('Current URL').textContent).toContain('q=++HmM++');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'SVM kernel' } });
    expect(screen.getByRole('heading', { name: 'Kernel SVM: Transforming Feature Space' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Hidden Markov Models' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Start path/ })).toHaveLength(getTopicLearningPaths('ml').length);
});

test('section changes preserve search and clear preserves the selected section', () => {
    renderTopic('/ml?section=algorithms&q=gradients');
    const sections = screen.getByRole('navigation', { name: 'Machine learning sections' });
    fireEvent.click(within(sections).getByRole('link', { name: 'Core Concepts' }));
    expect(screen.getByRole('heading', { name: 'Memory & Gradients Through Time' })).toBeDefined();
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('gradients');
    expect(screen.getByLabelText('Current URL').textContent).toBe('/ml?section=concepts&q=gradients');
    expect(screen.queryByRole('region', { name: 'Algorithms' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    expect(screen.getByLabelText('Current URL').textContent).toBe('/ml?section=concepts');
    expect(screen.getByRole('heading', { name: 'Bias–Variance Tradeoff' })).toBeDefined();
});

test('an unmatched search announces zero results and recovers without losing routes', () => {
    renderTopic('/ml?q=unfindable-lesson');
    expect(within(screen.getByRole('search')).getByRole('status').textContent).toContain('0 of');
    expect(screen.getByText(/No lessons match this search/)).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Machine learning families' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Start path/ })).toHaveLength(getTopicLearningPaths('ml').length);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.queryByText(/No lessons match this search/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Linear Regression' })).toBeDefined();
});

test('non-ML topics retain their direct lesson grid', () => {
    renderTopic('/calculus');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByText('Jump to a family')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Derivatives' })).toBeDefined();
});

test('each topic exposes paths with their topic lessons and preserves the path query', () => {
    for (const topicId of ['linear-algebra','calculus','probability']) {
        const { unmount, container } = renderTopic(`/${topicId}`);
        expect(screen.getByRole('heading', { name: 'Learning paths' })).toBeDefined();
        const links = container.querySelectorAll<HTMLAnchorElement>('.ml-path-start');
        expect(links.length).toBe(getTopicLearningPaths(topicId).length);
        for (const link of links) expect(link.getAttribute('href')).toContain('?path=');
        unmount();
    }
});
