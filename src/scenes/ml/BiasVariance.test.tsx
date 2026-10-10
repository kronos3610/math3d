// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import BiasVariance from './BiasVariance';

afterEach(cleanup);

function renderLab(): void {
    render(<MemoryRouter><BiasVariance /></MemoryRouter>);
}

function metricValue(label: string): string | null {
    return screen.getByText(label, { selector: 'dt' }).parentElement?.querySelector('dd')?.textContent ?? null;
}

test('experiment controls are labeled and charts have accessible descriptions', () => {
    renderLab();
    expect(screen.getByRole('slider', { name: /Model complexity/ })).toBeDefined();
    expect(screen.getByRole('slider', { name: /Noise standard deviation/ })).toBeDefined();
    expect(screen.getByRole('slider', { name: /Training sample size/ })).toBeDefined();
    expect(screen.getByRole('img', { name: /Fitted curves across independent training sets/ })).toBeDefined();
    expect(screen.getByRole('img', { name: /Training and test error versus model complexity/ })).toBeDefined();
    expect(screen.getByRole('img', { name: /Prediction error decomposition for selected degree/ })).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'Explain' })).toBeNull();
});

test('changing degree and noise updates the measured results and selected chart', () => {
    renderLab();
    const initialBias = metricValue('Squared bias');
    fireEvent.change(screen.getByRole('slider', { name: /Model complexity/ }), { target: { value: '1' } });
    expect(metricValue('Squared bias')).not.toBe(initialBias);
    expect(screen.getByRole('img', { name: /Fitted curves across independent training sets/ }).textContent).toContain('degree 1');
    fireEvent.change(screen.getByRole('slider', { name: /Noise standard deviation/ }), { target: { value: '0' } });
    expect(metricValue('Irreducible noise (σ²)')).toBe('0.000');
});

test('resampling changes the measured ensemble and explanation states finite-ensemble assumptions', () => {
    renderLab();
    const initialTestMSE = metricValue('Independent test MSE');
    fireEvent.click(screen.getByRole('button', { name: 'Resample training sets' }));
    expect(metricValue('Independent test MSE')).not.toBe(initialTestMSE);
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByText(/The decomposition is exact for this finite ensemble and grid/)).toBeDefined();
    expect(screen.getByText(/fixed, tiny ridge penalty/)).toBeDefined();
});
