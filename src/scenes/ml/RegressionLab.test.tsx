// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialSceneProps, SpatialSurface } from '../../components/3d/SpatialScene';
import RegressionLab, { type RegressionLabMode } from './RegressionLab';

// Keep the real lesson layout and numerical engine; only the graphics renderer is replaced.
vi.mock('../../components/3d/SpatialScene', () => ({
    SpatialScene: (props: SpatialSceneProps) => <div role="img" aria-label={props.description}>
        <output data-testid="surfaces">{JSON.stringify(props.surfaces)}</output>
        <output data-testid="points">{JSON.stringify(props.points)}</output>
        <output data-testid="vectors">{JSON.stringify(props.vectors)}</output>
    </div>,
}));
afterEach(cleanup);
function renderLab(mode: RegressionLabMode) { return render(<MemoryRouter><RegressionLab mode={mode} /></MemoryRouter>); }
const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent!;

test.each(['fit', 'solvers', 'assumptions', 'features'] as const)('%s exposes real scene controls, measurements, and optional explanation', mode => {
    renderLab(mode);
    expect(screen.getByRole('img', { name: /Computed least-squares|observed points/ })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Training observations' })).toBeDefined();
    expect(Number(metric('Independent test MSE'))).toBeGreaterThanOrEqual(0);
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByText('Fitting is different from inference')).toBeDefined();
    expect(screen.getByText(/Minimizing squares does not require Gaussian errors/)).toBeDefined();
});

test('quadratic features recover the noiseless curved mean in predictions and the actual surface', () => {
    renderLab('features');
    fireEvent.change(screen.getByRole('slider', { name: 'Observation noise σ' }), { target: { value: '0' } });
    expect(Number(metric('Training MSE'))).toBeGreaterThan(0.01);
    fireEvent.change(screen.getByRole('combobox', { name: 'Feature basis' }), { target: { value: 'quadratic' } });
    expect(metric('Training MSE')).toBe('0.000');
    expect(metric('Independent test MSE')).toBe('0.000');
    expect(metric('Design rank')).toBe('6/6');
    const surface = (JSON.parse(screen.getByTestId('surfaces').textContent!) as SpatialSurface[])[0];
    for (const [x1, y, x2] of surface.vertices) expect(y).toBeCloseTo(0.3 + 1.2 * x1 - 0.8 * x2 + 1.2 * x1 ** 2 - 0.7 * x1 * x2, 8);
    fireEvent.change(screen.getByRole('slider', { name: 'Ridge strength λ' }), { target: { value: '2' } });
    expect(Number(metric('Training MSE'))).toBeGreaterThan(0.01);
});

test('rank deficiency remains finite and an edited response changes a computed fit', () => {
    renderLab('fit');
    fireEvent.change(screen.getByRole('slider', { name: 'Observation noise σ' }), { target: { value: '0' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Data-generating scenario' }), { target: { value: 'collinear' } });
    expect(metric('Design rank')).toBe('2/3');
    expect(metric('Condition number')).toBe('∞');
    expect(metric('Training MSE')).toBe('0.000');
    const before = screen.getByTestId('surfaces').textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'Selected observed price y' }), { target: { value: '5' } });
    expect(Number(metric('Training MSE'))).toBeGreaterThan(0.1);
    expect(screen.getByTestId('surfaces').textContent).not.toBe(before);
    expect(screen.getByTestId('surfaces').textContent).not.toContain('null');
});

test('solver playback follows actual loss decreases and Newton reaches the direct optimum in one step', () => {
    renderLab('solvers');
    const initial = Number(metric('Objective'));
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(Number(metric('Objective'))).toBeLessThan(initial);
    fireEvent.change(screen.getByRole('combobox', { name: 'Least-squares solver' }), { target: { value: 'newton' } });
    expect(screen.getByRole('slider', { name: 'Solver step' }).getAttribute('max')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    const minimum = Number(metric('Objective'));
    expect(minimum).toBeLessThan(initial / 10);
    fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    expect(Number(metric('Objective'))).toBe(initial);
});

test('correlated-error diagnostics and training-only weights remain interactive', () => {
    renderLab('assumptions');
    fireEvent.change(screen.getByRole('combobox', { name: 'Data-generating scenario' }), { target: { value: 'correlated-errors' } });
    expect(Number(metric('Residual lag correlation'))).toBeGreaterThan(0.4);
    fireEvent.change(screen.getByRole('combobox', { name: 'Spatial view' }), { target: { value: 'residuals' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Data-generating scenario' }), { target: { value: 'heteroskedastic' } });
    const before = screen.getByTestId('points').textContent;
    fireEvent.change(screen.getByRole('combobox', { name: 'Observation weighting' }), { target: { value: 'variance' } });
    expect(screen.getByTestId('points').textContent).not.toBe(before);
    expect(Number(metric('Independent test MSE'))).toBeGreaterThan(0);
});

test('manual coefficients move the actual plane and copying fitted coefficients restores its optimizer', () => {
    renderLab('fit');
    const fittedMSE = metric('Training MSE');
    fireEvent.change(screen.getByRole('combobox', { name: 'Coefficient source' }), { target: { value: 'manual' } });
    expect(metric('Training MSE')).toBe(fittedMSE);
    fireEvent.change(screen.getByRole('slider', { name: 'Manual intercept b' }), { target: { value: '1' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Manual area coefficient β₁' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Manual distance coefficient β₂' }), { target: { value: '-1' } });
    const surface = (JSON.parse(screen.getByTestId('surfaces').textContent!) as SpatialSurface[])[0];
    for (const [x1, y, x2] of surface.vertices) expect(y).toBeCloseTo(1 + 2 * x1 - x2, 10);
    expect(Number(metric('Training MSE'))).toBeGreaterThan(Number(fittedMSE));
    expect(screen.getByText(/Manually chosen coefficients/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Copy fitted coefficients' }));
    expect(metric('Training MSE')).toBe(fittedMSE);
});

test('three-observation view renders the exact projection vectors and verifies perpendicular errors', () => {
    renderLab('solvers');
    fireEvent.change(screen.getByRole('combobox', { name: 'Solver geometry' }), { target: { value: 'projection' } });
    for (const [index, value] of [1, 0, 3].entries()) fireEvent.change(screen.getByRole('slider', { name: `Projection response y${index + 1}` }), { target: { value: String(value) } });
    expect(screen.getByRole('img', { name: /Exact three-observation response-space projection/ })).toBeDefined();
    expect(metric('Sample-space rank')).toBe('2/2');
    expect(Number(metric('Residual · 1'))).toBe(0);
    expect(Number(metric('Residual · x'))).toBe(0);
    expect(Number(metric('Projection residual norm'))).toBeCloseTo(Math.sqrt(8 / 3), 3);
    const vectors = JSON.parse(screen.getByTestId('vectors').textContent!) as { label: string; from: number[]; to: number[] }[];
    const fitted = vectors.find(vector => vector.label === 'ŷ')!.to;
    [1 / 3, 4 / 3, 7 / 3].forEach((value, index) => expect(fitted[index]).toBeCloseTo(value, 10));
    const residual = vectors.find(vector => vector.label === 'Residual')!;
    residual.from.forEach((value, index) => expect(value).toBeCloseTo(fitted[index], 10));
    expect(residual.to).toEqual([1, 0, 3]);
    expect(screen.queryByText('Independent test MSE', { selector: 'dt' })).toBeNull();
});

test('mini-batch selection exposes the batch size and produces real changing coefficient steps', () => {
    renderLab('solvers');
    fireEvent.change(screen.getByRole('combobox', { name: 'Least-squares solver' }), { target: { value: 'minibatch' } });
    const initial = screen.getByTestId('points').textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'Mini-batch observations' }), { target: { value: '48' } });
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(screen.getByTestId('points').textContent).not.toBe(initial);
    expect(screen.getByText(/Mini-batch GD \(batch 48\)/)).toBeDefined();
    const firstLoss = Number(metric('Objective'));
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(Number(metric('Objective'))).toBeLessThan(firstLoss);
});
