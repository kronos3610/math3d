// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialSceneProps, SpatialBox, SpatialPoint } from '../../components/3d/SpatialScene';
import StateSpaceLab from './StateSpaceLab';
import { makeStream, runStateSpace, type StateSpaceVariant } from '../../utils/ml-state-space';

vi.mock('../../components/3d/SpatialScene', () => ({ SpatialScene: (props: SpatialSceneProps) =>
    <div role="img" aria-label={props.description}>
        <output data-testid="points">{JSON.stringify(props.points)}</output>
        <output data-testid="boxes">{JSON.stringify(props.boxes)}</output>
    </div> }));
afterEach(cleanup);
const renderLab = (mode: StateSpaceVariant) => render(<MemoryRouter><StateSpaceLab mode={mode} /></MemoryRouter>);
const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent!;
const change = (name: string, value: string, role = 'combobox') => fireEvent.change(screen.getByRole(role, { name }), { target: { value } });

test.each(['ssm','mamba','mamba2','mamba3'] as const)('%s exposes a computed state scene and starts with explanation closed', mode => {
    renderLab(mode);
    expect(screen.getByRole('img')).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Scene panel' })).toBeNull();
    expect(Number.isFinite(Number(metric('Readout')))).toBe(true);
    expect(Number.isFinite(Number(metric('State norm')))).toBe(true);
});

test('an impulse decays after its only write and increasing decay shortens its influence', () => {
    renderLab('ssm');
    change('Input stream','impulse');
    fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    const first = Number(metric('State norm'));
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(Number(metric('State norm'))).toBeLessThan(first);
    const lowDecay = Number(metric('State norm'));
    change('Memory decay','2','slider');
    expect(Number(metric('State norm'))).toBeLessThan(lowDecay);
    expect(metric('Retained core state')).toBe('36 B');
});

test('Mamba-2 matrix shows only causal entries and changing channels updates actual coefficients', () => {
    renderLab('mamba2');
    change('Space view','matrix');
    const boxes = () => JSON.parse(screen.getByTestId('boxes').textContent!) as SpatialBox[];
    expect(boxes()).toHaveLength(15);
    expect(boxes().every(box => box.position[0] <= box.position[2])).toBe(true);
    expect(Number(metric('Matrix / recurrence error'))).toBeLessThan(1e-12);
    const before = screen.getByTestId('boxes').textContent;
    change('Channel','1');
    expect(screen.getByTestId('boxes').textContent).not.toBe(before);
    expect(Number(metric('Matrix / recurrence error'))).toBeLessThan(1e-12);
});

test('complex state norm includes imaginary components and endpoint/MIMO controls change the recurrence', () => {
    renderLab('mamba3');
    const trace = runStateSpace(makeStream('cue',12,0.2), { variant:'mamba3',decay:0.5,stepSize:0.5,selection:1,angle:0.8,lambda:0.5,mimo:false });
    expect(Number(metric('State norm'))).toBeCloseTo(Math.hypot(...trace.states[4][0],...trace.imaginary[4][0]),3);
    expect(metric('Retained core state')).toBe('108 B');
    const initial = screen.getByTestId('points').textContent;
    change('Current endpoint weight λ','1','slider');
    expect(screen.getByTestId('points').textContent).not.toBe(initial);
    const euler = metric('Readout');
    fireEvent.click(screen.getByRole('button', { name:'SISO: one stream' }));
    expect(screen.getByRole('button', { name:'MIMO: two streams' }).getAttribute('aria-pressed')).toBe('true');
    expect(metric('Readout')).not.toBe(euler);
    const last = (JSON.parse(screen.getByTestId('points').textContent!) as SpatialPoint[]).at(-1)!;
    expect(last.position[2]).toBe(4);
});
