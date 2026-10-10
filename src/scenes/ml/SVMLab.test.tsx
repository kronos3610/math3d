// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialPoint, SpatialSceneProps, SpatialSurface } from '../../components/3d/SpatialScene';
import SVMLab, { type SVMLabMode } from './SVMLab';

vi.mock('../../components/3d/SpatialScene', () => ({
    SpatialScene: (props: SpatialSceneProps) => <div role="img" aria-label={props.description}>
        <output data-testid="surfaces">{JSON.stringify(props.surfaces)}</output>
        <output data-testid="points">{JSON.stringify(props.points)}</output>
    </div>,
}));
afterEach(cleanup);
function renderLab(mode: SVMLabMode) { return render(<MemoryRouter><SVMLab mode={mode} /></MemoryRouter>); }
const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent!;

test.each(['margin', 'kernel', 'regression'] as const)('%s exposes editable observations, actual optimization measurements, and explanation', mode => {
    renderLab(mode);
    expect(screen.getByRole('img', { name: /actual .* fitted predictions/ })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Selected input x₁' })).toBeDefined();
    expect(Number(metric('KKT residual'))).toBeLessThanOrEqual(0.002);
    expect(Number(metric('Primal–dual gap'))).toBeGreaterThanOrEqual(0);
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByText('Actual optimization')).toBeDefined();
    expect(screen.getByText(/Its feature representation is implicit and not three-dimensional/)).toBeDefined();
});

test('changing a class and penalty changes the trained separating plane, with independent accuracy', () => {
    renderLab('margin');
    const before = screen.getByTestId('surfaces').textContent;
    const select = screen.getByRole('combobox', { name: 'Selected class' }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: select.value === '1' ? '-1' : '1' } });
    expect(screen.getByTestId('surfaces').textContent).not.toBe(before);
    const changed = screen.getByTestId('surfaces').textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'Violation penalty C' }), { target: { value: '0.05' } });
    expect(screen.getByTestId('surfaces').textContent).not.toBe(changed);
    expect(metric('Independent test accuracy')).toMatch(/^\d+\.\d%$/);
    expect(Number(metric('KKT residual'))).toBeLessThanOrEqual(0.002);
});

test('finite lift displays the exact feature coordinates while RBF displays a score surface', () => {
    renderLab('kernel');
    const points = JSON.parse(screen.getByTestId('points').textContent!) as SpatialPoint[];
    for (const point of points) expect(point.position[2]).toBeCloseTo(point.position[0] ** 2 + point.position[1] ** 2, 12);
    fireEvent.change(screen.getByRole('combobox', { name: 'Kernel' }), { target: { value: 'rbf' } });
    expect(screen.getByRole('img', { name: /actual rbf fitted predictions/ })).toBeDefined();
    expect(screen.getByText(/The vertical axis is a decision score/)).toBeDefined();
    const surfaces = JSON.parse(screen.getByTestId('surfaces').textContent!) as SpatialSurface[];
    expect(surfaces[1].vertices.every(vertex => vertex[1] === 0)).toBe(true);
    const before = screen.getByTestId('surfaces').textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'RBF locality γ' }), { target: { value: '5' } });
    expect(screen.getByTestId('surfaces').textContent).not.toBe(before);
});

test('SVR renders an actual epsilon tube and changes supports when its width changes', () => {
    renderLab('regression');
    const supports = metric('Support vectors');
    const surfaces = JSON.parse(screen.getByTestId('surfaces').textContent!) as SpatialSurface[];
    for (let index = 0; index < surfaces[0].vertices.length; index++) {
        expect(surfaces[0].vertices[index][1] - surfaces[1].vertices[index][1]).toBeCloseTo(0.15, 12);
        expect(surfaces[2].vertices[index][1] - surfaces[0].vertices[index][1]).toBeCloseTo(0.15, 12);
    }
    fireEvent.change(screen.getByRole('slider', { name: 'Insensitive tube ε' }), { target: { value: '0.8' } });
    expect(metric('Support vectors')).not.toBe(supports);
    expect(Number(metric('Training MSE'))).toBeGreaterThan(0);
    expect(Number(metric('Independent test MSE'))).toBeGreaterThan(0);
    const wide = JSON.parse(screen.getByTestId('surfaces').textContent!) as SpatialSurface[];
    expect(wide[2].vertices[0][1] - wide[1].vertices[0][1]).toBeCloseTo(1.6, 12);
});

test('the kernel linear option labels its score surface and zero threshold correctly', () => {
    renderLab('kernel');
    fireEvent.change(screen.getByRole('combobox', { name: 'Kernel' }), { target: { value: 'linear' } });
    const surfaces = JSON.parse(screen.getByTestId('surfaces').textContent!) as SpatialSurface[];
    expect(surfaces).toHaveLength(2);
    expect(surfaces[0].color).toBe('#2dd4bf');
    expect(surfaces[1].color).toBe('#fbbf24');
    expect(surfaces[1].vertices.every(vertex => vertex[1] === 0)).toBe(true);
    expect(screen.getByText(/Teal shows f\(x\); the gold zero plane is the decision threshold/)).toBeDefined();
    expect(screen.queryByText(/Green marks score zero; gold marks score ±1/)).toBeNull();
});
