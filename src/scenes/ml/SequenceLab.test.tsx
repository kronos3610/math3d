// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialSceneProps } from '../../components/3d/SpatialScene';
import SequenceLab, { type SequenceMode } from './SequenceLab';

vi.mock('../../components/3d/SpatialScene', () => ({
    SpatialScene: (props: SpatialSceneProps) => <div role="img" aria-label={props.description}>
        <output data-testid="computed-spatial-points">{JSON.stringify(props.points)}</output>
        <output data-testid="computed-spatial-vectors">{JSON.stringify(props.vectors)}</output>
    </div>,
}));
afterEach(cleanup);
const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent!;
function renderLab(mode: SequenceMode) { return render(<MemoryRouter><SequenceLab mode={mode} /></MemoryRouter>); }

test('HMM playback updates normalized beliefs; EM fits all readings and raises likelihood', () => {
    renderLab('hmm');
    expect(metric('Belief sum')).toBe('1.000');
    const initial = metric('Most likely current state');
    fireEvent.click(screen.getByRole('button', { name: 'Read through observation 5: high' }));
    expect(metric('Most likely current state')).not.toBe(initial);
    const before = Number(metric('Sequence log likelihood'));
    fireEvent.click(screen.getByRole('button', { name: 'Fit one EM update (all readings)' }));
    expect(Number(metric('Sequence log likelihood'))).toBeGreaterThanOrEqual(before);
    expect(metric('EM updates')).toBe('1');
    expect(metric('Belief sum')).toBe('1.000');
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'simplex' } });
    expect(screen.getByRole('img', { name: /Probability simplex/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset model' }));
    expect(metric('EM updates')).toBe('0');
});

test.each(['rnn', 'lstm', 'gru'] as const)('%s reveals actual state coordinates and resets playback to zero', mode => {
    renderLab(mode);
    const before = screen.getByTestId('computed-spatial-points').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    expect(metric('Processed inputs')).toBe('2 / 12');
    expect(screen.getByTestId('computed-spatial-points').textContent).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(metric('Current hidden norm')).toBe('0.0000');
    expect(metric('Processed inputs')).toBe('0 / 12');
    expect(screen.getByRole('slider', { name: /First cue/ })).toBeDefined();
    if (mode !== 'rnn') expect(screen.getByRole('combobox', { name: 'Inspect gate coordinate' })).toBeDefined();
});

test('RNN training updates a real readout while preserving explicit toy-task labeling', () => {
    renderLab('rnn');
    fireEvent.change(screen.getByRole('slider', { name: /Sequence length/ }), { target: { value: '6' } });
    for (let step = 1; step < 6; step++) fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    const initialError = Math.abs(Number(metric('Current linear readout')) - 1);
    fireEvent.click(screen.getByRole('button', { name: 'Train cue task 100 steps' }));
    expect(Math.abs(Number(metric('Current linear readout')) - 1)).toBeLessThan(initialError);
    expect(screen.getByText(/Trained on two cue sequences \(100 full-batch gradient-descent updates\)/)).toBeDefined();
});

test('LSTM input and output controls independently expose actual written versus visible state', () => {
    renderLab('lstm');
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'contributions' } });
    const initialWritten = metric('Written vector');
    const initialNorm = Number(metric('Current hidden norm'));
    fireEvent.change(screen.getByRole('slider', { name: 'Output-gate bias (manual weights)' }), { target: { value: '-5' } });
    expect(Number(metric('Current hidden norm'))).toBeLessThan(initialNorm / 20);
    expect(metric('Written vector')).toBe(initialWritten);
    fireEvent.change(screen.getByRole('slider', { name: 'Input-gate bias (manual weights)' }), { target: { value: '-5' } });
    expect(metric('Written vector')).not.toBe(initialWritten);
    expect(screen.getByRole('img', { name: /actual retained and written state vectors/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset gate biases' }));
    expect(metric('Written vector')).toBe(initialWritten);
});

test('GRU reset bias changes the candidate contribution after a nonzero previous state', () => {
    renderLab('gru');
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'contributions' } });
    const initial = screen.getByTestId('computed-spatial-vectors').textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'Reset-gate bias (manual weights)' }), { target: { value: '5' } });
    expect(screen.getByTestId('computed-spatial-vectors').textContent).not.toBe(initial);
    expect(screen.getByRole('slider', { name: 'Retain-gate bias (manual weights)' })).toBeDefined();
});

test('truncation and clipping update measured gradients without changing the forward loss', () => {
    renderLab('gradients');
    const loss = metric('Final-step loss');
    const before = metric('Parameter norm before → after');
    expect(Number(metric('Gradient check error'))).toBeLessThan(1e-6);
    fireEvent.change(screen.getByRole('slider', { name: /Backpropagation window/ }), { target: { value: '2' } });
    expect(metric('Final-step loss')).toBe(loss);
    expect(metric('Parameter norm before → after')).not.toBe(before);
    fireEvent.change(screen.getByRole('slider', { name: /Global clipping threshold/ }), { target: { value: '0.05' } });
    expect(metric('Parameter norm before → after').split(' → ')[1]).toBe('0.050');
    expect(metric('Final-step loss')).toBe(loss);
});
