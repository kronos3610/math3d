// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialPoint, SpatialSceneProps } from '../../components/3d/SpatialScene';
import { createFeedforwardWeights, feedforward } from '../../utils/ml-sequence';
import NeuralNetworks from './NeuralNetworks';

vi.mock('../../components/3d/SpatialScene', () => ({
    SpatialScene: (props: SpatialSceneProps) => <div role="img" aria-label={props.description}>
        <output data-testid="computed-network-points">{JSON.stringify(props.points)}</output>
    </div>,
}));
afterEach(cleanup);
const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent!;

test('inputs and connection edits change actual activations and loss', () => {
    render(<MemoryRouter><NeuralNetworks /></MemoryRouter>);
    const probability = metric('Output probability');
    const coordinates = screen.getByTestId('computed-network-points').textContent;
    fireEvent.change(screen.getByRole('slider', { name: /^Input 1/ }), { target: { value: '1' } });
    expect(metric('Output probability')).not.toBe(probability);
    expect(screen.getByTestId('computed-network-points').textContent).not.toBe(coordinates);
    const loss = metric('Training loss');
    fireEvent.change(screen.getByRole('slider', { name: /Connection weight/ }), { target: { value: '-2' } });
    expect(metric('Training loss')).not.toBe(loss);
    expect(metric('Training updates')).toBe('0');
});

test('training reduces binary cross entropy and reset restores demonstration weights', () => {
    render(<MemoryRouter><NeuralNetworks /></MemoryRouter>);
    const loss = Number(metric('Training loss'));
    const probability = metric('Output probability');
    fireEvent.click(screen.getByRole('button', { name: 'Train 200 steps' }));
    expect(Number(metric('Training loss'))).toBeLessThan(loss);
    expect(metric('Training updates')).toBe('200');
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'surface' } });
    expect(screen.getByRole('img', { name: /Actual sigmoid output/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset weights' }));
    expect(metric('Training updates')).toBe('0');
    expect(metric('Output probability')).toBe(probability);
    expect(Number(metric('Training loss'))).toBe(loss);
});

test('network height is the actual activation; depth only lays out units', () => {
    render(<MemoryRouter><NeuralNetworks /></MemoryRouter>);
    const result = feedforward([-1, 1], createFeedforwardWeights());
    const points = JSON.parse(screen.getByTestId('computed-network-points').textContent!) as SpatialPoint[];
    expect(points.slice(0, 2).map(point => point.position[1])).toEqual([-1, 1]);
    expect(points.slice(2, 5).map(point => point.position[1])).toEqual(result.hidden);
    expect(points.slice(2, 5).map(point => point.position[2])).toEqual([-1, 0, 1]);
    expect(points[5].position[1]).toBe(result.probability);
    expect(points[5].position[2]).toBe(0);
});
