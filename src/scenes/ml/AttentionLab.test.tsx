// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialSceneProps, SpatialPoint, SpatialPath } from '../../components/3d/SpatialScene';
import AttentionLab, { type AttentionLabMode } from './AttentionLab';

// Keep the layout, controls, and numerical engines real. Replace only WebGL rendering.
vi.mock('../../components/3d/SpatialScene', () => ({ SpatialScene: (props: SpatialSceneProps) =>
    <div role="img" aria-label={props.description}>
        <output data-testid="points">{JSON.stringify(props.points)}</output>
        <output data-testid="paths">{JSON.stringify(props.paths)}</output>
        <output data-testid="vectors">{JSON.stringify(props.vectors)}</output>
    </div> }));
afterEach(cleanup);
const renderLab = (mode: AttentionLabMode) => render(<MemoryRouter><AttentionLab mode={mode} /></MemoryRouter>);
const metric = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent!;
const change = (name: string, value: string, role = 'combobox') => fireEvent.change(screen.getByRole(role, { name }), { target: { value } });
const points = () => JSON.parse(screen.getByTestId('points').textContent!) as SpatialPoint[];

test.each(['attention','block','architectures','position','cache','efficient','experts','vision','flash','memory','hybrid','embeddings','softmax','normalization'] as const)(
    '%s starts with its visualization and controls, with explanation closed', mode => {
        renderLab(mode);
        expect(screen.getByRole('img')).toBeDefined();
        expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
        expect(screen.queryByRole('complementary', { name: 'Scene panel' })).toBeNull();
        expect(screen.getByRole('combobox', { name: mode === 'vision' ? 'Patch' : mode === 'cache' ? 'Decode through token' : 'Selected token' })).toBeDefined();
    });

test('zero query gives equal weights only to permitted keys, and changing the mask changes connectivity', () => {
    renderLab('attention');
    change('Query magnitude','0','slider');
    fireEvent.click(screen.getByRole('button', { name: 'Show weights' }));
    const row = screen.getByRole('table').querySelectorAll('tbody tr')[2];
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.33','0.33','0.33','0.00','0.00','0.00']);
    change('Attention mask','bidirectional');
    expect(within(screen.getByRole('table').querySelectorAll('tbody tr')[2] as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(Array(6).fill('0.17'));
    expect(metric('Weight sum')).toBe('1.000');
});

test('cache storage, table extent, and future-token labels follow the decoded prefix and head sharing', () => {
    renderLab('cache');
    change('Attention heads','4','slider');
    expect(metric('KV cache (float32)')).toBe('96 B');
    fireEvent.click(screen.getByRole('button', { name: 'Show weights' }));
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
    expect(points().filter(point => point.label?.startsWith('Future token'))).toHaveLength(5);
    change('Decode through token','2');
    expect(metric('KV cache (float32)')).toBe('288 B');
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(3);
    for (const [layout, bytes] of [['gqa','144 B'],['mqa','72 B'],['mla','48 B']]) {
        change('Key/value layout',layout);
        expect(metric('KV cache (float32)')).toBe(bytes);
        expect(Number(metric('Cached / direct error'))).toBeLessThan(1e-12);
    }
    expect(screen.queryByRole('combobox', { name: 'Position encoding' })).toBeNull();
    expect(screen.getByText('MLA · fixed decoupled RoPE')).toBeDefined();
});

test('tiled attention displays normalized prefix weights and then adds the next permitted key', () => {
    renderLab('flash');
    const initialNorm = metric('Prefix output norm');
    const active = () => points().filter(point => point.position[1] > 0);
    expect(active()).toHaveLength(2);
    expect(active().reduce((sum,point) => sum + point.position[1],0)).toBeCloseTo(1,12);
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(active()).toHaveLength(3);
    expect(active().reduce((sum,point) => sum + point.position[1],0)).toBeCloseTo(1,12);
    expect(metric('Prefix output norm')).not.toBe(initialNorm);
    expect(Number(metric('Final / dense error'))).toBeLessThan(1e-12);
    expect(screen.getByText(/4 keys processed/)).toBeDefined();
});

test('block stage and activation change the shown representations rather than only their labels', () => {
    renderLab('block');
    const initial = screen.getByTestId('points').textContent;
    for (let step = 0; step < 4; step++) fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(screen.getByTestId('points').textContent).not.toBe(initial);
    const gelu = metric('Shown representation norm');
    change('Feed-forward activation','swiglu');
    expect(metric('Shown representation norm')).not.toBe(gelu);
    const selected = points()[2].position;
    expect(Number(metric('Shown representation norm'))).toBeCloseTo(Math.hypot(...selected),3);
    fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    expect(screen.getByTestId('points').textContent).toBe(initial);
});

test('expert capacity removes dropped paths and does not offer an unrelated attention table', () => {
    renderLab('experts');
    expect(screen.queryByRole('button', { name: 'Show weights' })).toBeNull();
    change('Experts per token','3','slider');
    change('Capacity factor','0.25','slider');
    expect(Number(metric('Dropped routes'))).toBeGreaterThan(0);
    change('Capacity factor','3','slider');
    expect(metric('Dropped routes')).toBe('0');
    expect(metric('Accepted routes')).toBe('18');
    const paths = JSON.parse(screen.getByTestId('paths').textContent!) as SpatialPath[];
    expect(paths.some(path => path.dashed)).toBe(false);
});

test('patch tokenization and shared embedding edits change the actual plotted inputs', () => {
    const lesson = renderLab('vision');
    expect(metric('Patches')).toBe('16');
    change('Patch edge','4');
    expect(metric('Patches')).toBe('4');
    expect(metric('Selected patch')).toBe('1');
    lesson.unmount();
    renderLab('embeddings');
    change('Selected token','1');
    fireEvent.click(screen.getByRole('button', { name: 'Edit embedding' }));
    change('Embedding coordinate 1','2','slider');
    expect(points()[1].position[0]).toBe(2);
    expect(points()[4].position[0]).toBe(2);
    expect(points()[0].position[0]).not.toBe(2);
    expect(Number(metric('Embedding norm'))).toBeCloseTo(Math.hypot(...points()[1].position),3);
});

test('hybrid storage starts empty and grows only after the represented layer executes', () => {
    renderLab('hybrid');
    expect(metric('Retained mixer state')).toBe('0 B');
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    const attentionBytes = Number(metric('Retained mixer state').split(' ')[0]);
    expect(attentionBytes).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(Number(metric('Retained mixer state').split(' ')[0])).toBeGreaterThan(attentionBytes);
    const selected = points()[2].position;
    expect(Number(metric('Shown representation norm'))).toBeCloseTo(Math.hypot(...selected),3);
});
