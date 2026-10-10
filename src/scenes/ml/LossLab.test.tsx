// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialSceneProps } from '../../components/3d/SpatialScene';
import LossLab, { type LossLabMode } from './LossLab';

vi.mock('../../components/3d/SpatialScene', () => ({
    SpatialScene: (props: SpatialSceneProps) => <div role="img" aria-label={props.description}>
        <output data-testid="computed-loss-points">{JSON.stringify(props.points)}</output>
    </div>,
}));
afterEach(cleanup);
const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent!;
function renderLab(mode: LossLabMode) { return render(<MemoryRouter><LossLab mode={mode} /></MemoryRouter>); }

test('loss selection recomputes actual derivatives and exposes the absolute-loss corner', () => {
    renderLab('losses');
    expect(metric('Selected loss')).toBe('1.1250');
    fireEvent.change(screen.getByRole('combobox', { name: 'Loss function' }), { target: { value: 'absolute' } });
    expect(metric('Selected loss')).toBe('1.5000');
    expect(metric('Prediction derivative')).toBe('1.0000');
    fireEvent.change(screen.getByRole('slider', { name: 'Prediction' }), { target: { value: '0' } });
    expect(metric('Prediction derivative')).toBe('not unique at zero');
    fireEvent.change(screen.getByRole('combobox', { name: 'Loss function' }), { target: { value: 'huber' } });
    expect(screen.getByRole('slider', { name: 'Huber transition δ' })).toBeDefined();
});

test('classification uses a logit and binary presets; returning to regression keeps inputs in range', () => {
    renderLab('losses');
    fireEvent.change(screen.getByRole('combobox', { name: 'Loss function' }), { target: { value: 'bce' } });
    fireEvent.click(screen.getByRole('button', { name: 'Target class 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try a large mistake' }));
    expect(Number(metric('Selected loss'))).toBeGreaterThan(4);
    expect(Number(metric('Sigmoid probability'))).toBeLessThan(0.02);
    expect(screen.getByRole('button', { name: 'Target class 1' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByRole('combobox', { name: 'Loss function' }), { target: { value: 'squared' } });
    expect((screen.getByRole('slider', { name: 'Prediction' }) as HTMLInputElement).value).toBe('-3');
});

test('standardization changes measured conditioning and playback reveals actual descent', () => {
    renderLab('conditioning');
    const originalCondition = Number(metric('Hessian condition number'));
    const originalLoss = Number(metric('Current half MSE'));
    fireEvent.click(screen.getByRole('button', { name: 'Raw feature units' }));
    expect(Number(metric('Hessian condition number'))).toBeLessThan(originalCondition);
    expect(screen.getByRole('button', { name: 'Standardized features' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Show computed final step' }));
    expect(Number(metric('Current half MSE'))).toBeLessThan(originalLoss);
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'features' } });
    expect(screen.getByRole('img', { name: /Actual two-feature regression data/ })).toBeDefined();
});

test('validation controls alter finite fits and resampling changes the evidence', () => {
    renderLab('validation');
    const initialTraining = metric('Training MSE');
    const initialValidation = metric('Validation MSE');
    fireEvent.click(screen.getByRole('button', { name: 'Add one training outlier' }));
    expect(metric('Training MSE')).not.toBe(initialTraining);
    expect(metric('Validation MSE')).not.toBe(initialValidation);
    expect(screen.getByRole('button', { name: 'Training outlier added' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByRole('slider', { name: 'Polynomial degree' }), { target: { value: '8' } });
    expect(metric('Fitted coefficients')).toBe('9');
    const before = metric('Validation MSE');
    fireEvent.click(screen.getByRole('button', { name: 'Resample both sets' }));
    expect(metric('Validation MSE')).not.toBe(before);
    expect(Number.isFinite(Number(metric('Validation MSE')))).toBe(true);
});
