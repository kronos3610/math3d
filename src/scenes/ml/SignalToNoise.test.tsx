// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import SignalToNoise from './SignalToNoise';

afterEach(cleanup);

test('SNR controls expose zero limits and preserve the ratio when model complexity changes', () => {
    render(<MemoryRouter><SignalToNoise /></MemoryRouter>);
    expect(screen.getByRole('img', { name: /Signal, noisy observations, and fitted polynomial/ })).toBeDefined();
    const measurements = screen.getByLabelText('Signal-to-noise measurements');
    expect(within(measurements).getByText('4.082')).toBeDefined();
    fireEvent.change(screen.getByRole('slider', { name: /Polynomial degree/ }), { target: { value: '1' } });
    expect(within(measurements).getByText('4.082')).toBeDefined();
    fireEvent.change(screen.getByRole('slider', { name: /Noise standard deviation/ }), { target: { value: '0' } });
    expect(within(measurements).getByText('∞')).toBeDefined();
    fireEvent.change(screen.getByRole('slider', { name: /Signal amplitude/ }), { target: { value: '0' } });
    expect(within(measurements).getAllByText('Undefined (0 / 0)')).toHaveLength(2);
});

test('resampling can be reproduced with the displayed seed', () => {
    render(<MemoryRouter><SignalToNoise /></MemoryRouter>);
    const originalChart = screen.getByRole('img', { name: /Signal, noisy observations, and fitted polynomial/ }).innerHTML;
    fireEvent.click(screen.getByRole('button', { name: 'Resample observations' }));
    expect(screen.getByRole('img', { name: /Signal, noisy observations, and fitted polynomial/ }).innerHTML).not.toBe(originalChart);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Random seed' }), { target: { value: '3610' } });
    expect(screen.getByRole('img', { name: /Signal, noisy observations, and fitted polynomial/ }).innerHTML).toBe(originalChart);
});
