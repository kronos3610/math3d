// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import DecisionBoundaries from './DecisionBoundaries';
import { VIZ } from '../../data/palette';

vi.mock('../../components/3d/SceneCanvas', () => ({ SceneCanvas: ({ fallback }: { fallback: ReactNode }) => <>{fallback}</> }));
afterEach(cleanup);
const metric = (label: string) => [...document.querySelectorAll('.visual-lab-metrics > div')].find(e => e.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;

test('changing the 3D rule changes counted errors and error rings in the native projection', () => {
    render(<MemoryRouter initialEntries={['/ml/decision-boundaries']}><Routes><Route path="/:topicId/:subtopicId" element={<DecisionBoundaries />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.getByRole('slider', { name: 'Plane turn' })).toBeDefined();
    const before = metric('Accuracy');
    fireEvent.change(screen.getByRole('slider', { name: 'Plane turn' }), { target: { value: '-110' } });
    expect(metric('Accuracy')).not.toBe(before);
    fireEvent.change(screen.getByRole('combobox', { name: 'Dataset' }), { target: { value: 'shells' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Boundary' }), { target: { value: 'sphere' } });
    expect(metric('Accuracy')).toBe('100.0%');
    expect(metric('Misclassified')).toBe('0/80');
    expect(screen.queryByRole('slider', { name: 'Plane turn' })).toBeNull();
    fireEvent.change(screen.getByRole('slider', { name: 'Sphere radius' }), { target: { value: '3' } });
    expect(metric('Misclassified')).toBe('40/80');
    const plot = screen.getByRole('img', { name: /Three-feature decision boundary/ });
    expect(plot.querySelectorAll(`circle[stroke="${VIZ.error}"]`)).toHaveLength(40);
    expect(plot.querySelector('desc')?.textContent).toContain('three-dimensional');
});
