// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import LagrangeConstraints from './LagrangeConstraints';

// Preserve the real routing, drawer, view controls and CPU-derived readouts.
vi.mock('../../components/3d/SceneCanvas', () => ({
    SceneCanvas: (props: { 'aria-label'?: string }) => <div role="img" aria-label={props['aria-label']} />,
}));
afterEach(cleanup);

test('view choices remain visible with the drawer closed and disclose current weight scale and contour cropping', () => {
    render(<MemoryRouter initialEntries={['/ml/lagrange-constraints']}><Routes><Route path="/:topicId/:subtopicId" element={<LagrangeConstraints />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole('complementary', { name: 'Scene panel' })).toBeNull();
    const views = within(screen.getByRole('group', { name: 'Constraint visualization view' }));
    expect(views.getByRole('button', { name: 'Constraint detail' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Local contour crop: ±1.88 weights/)).toBeDefined();
    expect(screen.getByText(/L2 radius 1.50.*t² budget 2.25.*axes \+1.65 weight units/)).toBeDefined();
    fireEvent.click(views.getByRole('button', { name: 'Full objective' }));
    expect(views.getByRole('button', { name: 'Full objective' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Complete current loss contour and its unconstrained center.')).toBeDefined();
    views.getByRole('button', { name: 'Fit view' }).focus();
    expect(document.activeElement).toBe(views.getByRole('button', { name: 'Fit view' }));
    const axes = within(screen.getByRole('list', { name: 'Plot axis meanings' }));
    expect(axes.getByText(/weight 1/)).toBeDefined();
});

test('norm and budget controls update exact readouts and identify coincident minima without claiming a blue ellipsoid', () => {
    render(<MemoryRouter initialEntries={['/ml/lagrange-constraints']}><Routes><Route path="/:topicId/:subtopicId" element={<LagrangeConstraints />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    const controls = within(screen.getByRole('tabpanel', { name: 'Controls' }));
    fireEvent.click(controls.getByRole('button', { name: 'Lasso (L1)' }));
    expect(screen.getByText('Red minimum: (0.00, 0.50, 1.00); loss 10.50.')).toBeDefined();
    const budget = controls.getByRole('slider', { name: 'Allowed Budget' });
    fireEvent.change(budget, { target: { value: '8' } });
    expect(screen.getByText(/Unconstrained minimum is feasible; the minima coincide.*no blue ellipsoid/)).toBeDefined();
    expect(screen.getByText('Coincident minimum: (3.00, 2.50, 2.00); loss 0.')).toBeDefined();
    expect(screen.getByText(/L1 budget 8.00.*axes \+8.80 weight units/)).toBeDefined();
    fireEvent.click(controls.getByRole('button', { name: 'Ridge (L2)' }));
    expect(screen.getByText(/L2 radius 8.00.*t² budget 64.00/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Full objective' }));
    expect(screen.getByText(/Unconstrained minimum is feasible; the minima coincide.*no blue ellipsoid/)).toBeDefined();
});
