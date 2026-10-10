// @vitest-environment jsdom
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LabPlayback, LabRange, LabSelect, VisualLab } from './VisualLab';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Controls() {
    const [rate, setRate] = useState(0.25);
    const [method, setMethod] = useState('direct');
    return <>
        <LabRange label="Learning rate" value={rate} min={0.05} max={1} step={0.05} decimals={2} onChange={setRate} />
        <LabSelect label="Method" value={method} options={[{ value: 'direct', label: 'Direct solution' }, { value: 'iterative', label: 'Iterative solution' }]} onChange={setMethod} />
        <p role="status" aria-label="Chosen settings">{method}: {rate.toFixed(2)}</p>
    </>;
}

test('the experiment is available first and its longer explanation opens by keyboard', () => {
    render(<MemoryRouter initialEntries={['/ml/linear-regression']}><Routes><Route path="/:topicId/:subtopicId" element={
        <VisualLab title="Regression experiment" subtitle="Move the observations." controls={<Controls />}
            metrics={[{ label: 'Error', value: '0.125' }]} insight="The residual shrank." challenge="Change the learning rate."
            explanation={<p>Detailed model explanation.</p>}><div role="img" aria-label="Fitted plane and observations" /></VisualLab>
    } /></Routes></MemoryRouter>);

    expect(screen.getByRole('region', { name: 'Regression experiment' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Fitted plane and observations' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Learning rate' })).toBeDefined();
    expect(screen.queryByText('Detailed model explanation.')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.getByLabelText('Regression experiment measurements').textContent).toContain('Error0.125');
    expect(screen.getByText('The residual shrank.').getAttribute('aria-live')).toBe('polite');

    const opener = screen.getByRole('button', { name: 'Open scene panel' });
    opener.focus();
    expect(document.activeElement).toBe(opener);
    fireEvent.click(opener);
    const guide = screen.getByRole('tab', { name: 'Guide' });
    guide.focus();
    fireEvent.keyDown(guide, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Explain' }));
    expect(screen.getByRole('tabpanel', { name: 'Explain' }).textContent).toContain('Detailed model explanation.');
    // The visible controls remain available when the optional explanation is open.
    expect(screen.getByRole('slider', { name: 'Learning rate' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/ml');
});

test('range and select use native controls with stable names and updated values', () => {
    render(<Controls />);
    const range = screen.getByRole('slider', { name: 'Learning rate' }) as HTMLInputElement;
    expect(range.type).toBe('range');
    expect([range.min, range.max, range.step]).toEqual(['0.05', '1', '0.05']);
    expect(range.getAttribute('aria-valuetext')).toBe('0.25');
    range.focus();
    expect(document.activeElement).toBe(range);
    fireEvent.change(range, { target: { value: '0.6' } });
    expect(range.value).toBe('0.6');
    expect(range.getAttribute('aria-valuetext')).toBe('0.60');
    expect(screen.getByRole('slider', { name: 'Learning rate' })).toBe(range);

    const select = screen.getByRole('combobox', { name: 'Method' }) as HTMLSelectElement;
    select.focus();
    expect(document.activeElement).toBe(select);
    fireEvent.change(select, { target: { value: 'iterative' } });
    expect(select.value).toBe('iterative');
    expect(screen.getByRole('status', { name: 'Chosen settings' }).textContent).toBe('iterative: 0.60');
});

function Playback({ onReset }: { onReset?: () => void }) {
    const [step, setStep] = useState(0);
    return <LabPlayback step={step} max={2} interval={100} onStep={setStep} onReset={onReset} />;
}

test('playback advances only after Play, stops at the end, and restarts explicitly', () => {
    vi.useFakeTimers();
    render(<Playback />);
    expect(screen.getByRole('group', { name: 'Experiment playback' })).toBeDefined();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Step 0 / 2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed')).toBe('true');
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('Step 1 / 2')).toBeDefined();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('Step 2 / 2')).toBeDefined();
    expect((screen.getByRole('button', { name: 'Step' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('aria-pressed')).toBe('false');
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByText('Step 0 / 2')).toBeDefined();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('Step 1 / 2')).toBeDefined();
});

test('Pause, Step, Reset, and unmount cancel pending playback', () => {
    vi.useFakeTimers();
    const onReset = vi.fn();
    const { unmount } = render(<Playback onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('Step 0 / 2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('Step 1 / 2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Step 0 / 2')).toBeDefined();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
});
