// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { SpatialSceneProps } from '../../components/3d/SpatialScene';
import TreeLab from './TreeLab';
import type { TreeLabMode } from './TreeLab';

// Keep the real model fitting, controls, metrics, and optional lesson. The GPU
// renderer is checked in-browser; capture actual geometry computed by the scene.
const plotted = vi.hoisted(() => ({ latest: null as SpatialSceneProps | null }));
vi.mock('../../components/3d/SpatialScene', () => ({ SpatialScene: (props: SpatialSceneProps) => {
    plotted.latest = props;
    return <div role="img" aria-label={props.description} />;
} }));
afterEach(() => { cleanup(); plotted.latest = null; });

const modes: Array<{ mode: TreeLabMode; title: string }> = [
    { mode: 'tree', title: 'Decision Trees' }, { mode: 'bagging', title: 'Bagging & Random Forests' },
    { mode: 'boosting', title: 'Boosting' }, { mode: 'xgboost', title: 'XGBoost: Newton Tree Boosting' },
    { mode: 'lightgbm', title: 'LightGBM: Histogram & Leafwise Growth' },
];
function mount(mode: TreeLabMode) { render(<MemoryRouter><TreeLab mode={mode} /></MemoryRouter>); }
function metric(label: string): string {
    const definition = screen.getByText(label, { selector: 'dt' });
    return definition.nextElementSibling?.textContent ?? '';
}
function range(label: string, value: number) { fireEvent.change(screen.getByRole('slider', { name: label }), { target: { value: String(value) } }); }
function choose(label: string, value: string) { fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } }); }
function geometry(): SpatialSceneProps {
    if (!plotted.latest) throw new Error('The scene must supply computed geometry.');
    return plotted.latest;
}

test.each(modes)('$title starts with a real prediction space and accessible controls, keeping the long lesson optional', ({ mode, title }) => {
    mount(mode);
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeDefined();
    expect(screen.getByRole('img', { name: /fitted prediction space/ })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/ml');
    expect(screen.queryByRole('region', { name: `${title} explanation` })).toBeNull();
    expect(geometry().points).toHaveLength(49);
    expect(geometry().paths).toHaveLength(48);
    const query = geometry().points?.at(-1)?.position;
    expect(query?.[0]).toBe(0.3);
    expect(query?.[2]).toBe(0.3);
    expect(Number(metric('Query prediction'))).toBeCloseTo(query?.[1] ?? NaN, 3);
    const slider = screen.getByRole('slider', { name: 'Query feature x₁' });
    slider.focus(); expect(document.activeElement).toBe(slider);
    expect(slider.getAttribute('type')).toBe('range');
    range('Query feature x₁', -0.8);
    range('Query feature x₂', 0.7);
    expect(geometry().points?.at(-1)?.position[0]).toBe(-0.8);
    expect(geometry().points?.at(-1)?.position[2]).toBe(0.7);
    expect(Number(metric('Query prediction'))).toBeCloseTo(geometry().points?.at(-1)?.position[1] ?? NaN, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    const explanation = screen.getByRole('region', { name: `${title} explanation` });
    expect(within(explanation).getByRole('heading', { name: 'Assumptions, limitations, and uses' })).toBeDefined();
    expect(within(explanation).getAllByRole('link').length).toBeGreaterThanOrEqual(4);
});

test('tree depth and pruning change actual leaf regions; query playback follows threshold decisions', () => {
    mount('tree');
    range('Maximum tree depth', 1);
    expect(Number(metric('Leaf count'))).toBeLessThanOrEqual(2);
    expect(geometry().boxes).toHaveLength(Number(metric('Leaf count')));
    range('Maximum tree depth', 5);
    range('Minimum samples per leaf', 1);
    const complexLeaves = Number(metric('Leaf count'));
    expect(complexLeaves).toBeGreaterThan(2);
    range('Cost complexity pruning α', 0.3);
    expect(Number(metric('Leaf count'))).toBeLessThan(complexLeaves);
    choose('Target task', 'regression');
    expect(metric('Train MSE')).toMatch(/^\d+\.\d{3}$/);
    expect(geometry().points?.slice(0, 48).some(point => point.position[1] !== 0 && point.position[1] !== 1)).toBe(true);
    range('Cost complexity pruning α', 0);
    choose('Visualization', 'structure');
    expect(screen.getByRole('img', { name: /actual fitted tree and the gold prediction path/ })).toBeDefined();
    expect(geometry().points?.filter(point => point.color === '#fbbf24')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    expect(geometry().points?.filter(point => point.color === '#fbbf24')).toHaveLength(2);
    expect(geometry().paths?.some(path => path.color === '#fbbf24' && path.width === 4)).toBe(true);
});

test('bagging exposes genuine OOB coverage and independent bootstrap variability', () => {
    mount('bagging');
    const firstCoverage = Number(metric('OOB coverage').split('/')[0]);
    expect(firstCoverage).toBeGreaterThan(0);
    expect(firstCoverage).toBeLessThan(48);
    expect(geometry().points?.slice(0, 48).filter(point => point.color === '#64748b')).toHaveLength(firstCoverage);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(metric('Trees included')).toBe('0');
    expect(metric('OOB coverage')).toBe('0/48');
    expect(metric('OOB score')).toBe('Not available');
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    expect(Number(metric('OOB coverage').split('/')[0])).toBeGreaterThanOrEqual(firstCoverage);
    choose('Features considered at each split', '1');
    choose('Visualization', 'variance');
    expect(geometry().points).toHaveLength(16);
    expect(geometry().paths).toHaveLength(2);
    const values = geometry().points ?? [];
    const empiricalVariance = (z: number) => {
        const predictions = values.filter(point => point.position[2] === z).map(point => point.position[1]);
        const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
        return predictions.reduce((total, prediction) => total + (prediction - mean) ** 2, 0) / 7;
    };
    expect(screen.getByText(/single-tree variance/).textContent).toContain(`single-tree variance ${empiricalVariance(0).toFixed(3)}`);
    expect(screen.getByText(/single-tree variance/).textContent).toContain(`ensemble variance ${empiricalVariance(1).toFixed(3)}`);
});

test('boosting playback displays computed losses and AdaBoost uses real nonuniform example weights', () => {
    mount('boosting');
    choose('Visualization', 'loss');
    expect(geometry().points).toHaveLength(2);
    const initialLoss = geometry().points?.[0].position[1] ?? NaN;
    const firstLoss = geometry().points?.[1].position[1] ?? NaN;
    expect(firstLoss).toBeLessThan(initialLoss);
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    expect(geometry().points).toHaveLength(3);
    expect(metric('Trees included')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(geometry().points).toHaveLength(1);
    choose('Visualization', 'prediction');
    choose('Boosting algorithm', 'adaboost');
    expect((screen.getByRole('combobox', { name: 'Target task' }) as HTMLSelectElement).value).toBe('classification');
    expect(screen.queryByRole('slider', { name: 'Maximum tree depth' })).toBeNull();
    expect(screen.getByText(/weighted decision stumps/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));
    const radii = geometry().points?.slice(0, 48).map(point => point.radius);
    expect(new Set(radii).size).toBeGreaterThan(1);
    expect(screen.getByText(/Marker sizes show actual pre-round example weights/)).toBeDefined();
});

test('XGBoost regularization and growth controls change fitted numerical predictions', () => {
    mount('xgboost');
    const before = Number(metric('Query prediction'));
    const rowsBefore = geometry().points?.slice(0, 48).map(point => point.position);
    range('Leaf penalty λ', 10);
    expect(Number(metric('Query prediction'))).not.toBe(before);
    expect(geometry().points?.slice(0, 48).map(point => point.position)).toEqual(rowsBefore);
    choose('Teaching tree growth policy', 'leafwise');
    choose('Visualization', 'structure');
    expect(screen.getByText(/Root statistics: G=/).textContent).toMatch(/H=.*w=−G\/\(H\+λ\)=.*split gain=/);
    expect(geometry().points?.some(point => point.label?.startsWith('x'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByText(/XGBoost is not inherently restricted to depthwise trees/)).toBeDefined();
});

test('LightGBM GOSS visibly retains actual rows and exclusive packing preserves its two indicators', () => {
    mount('lightgbm');
    const initialVertices = geometry().surfaces?.[0].vertices;
    range('Histogram bins per feature', 2);
    expect(geometry().surfaces?.[0].vertices).not.toEqual(initialVertices);
    choose('Gradient sampling', 'goss');
    const points = geometry().points?.slice(0, 48) ?? [];
    expect(points.filter(point => point.color === '#fbbf24')).toHaveLength(12);
    expect(points.filter(point => point.color === '#2dd4bf')).toHaveLength(12);
    expect(points.filter(point => point.color === '#64748b')).toHaveLength(24);
    expect(screen.getByText(/GOSS retained 24\/48 rows/).textContent).toContain('weight 3.000');
    const prediction = metric('Query prediction');
    choose('Visualization', 'bundle');
    const packed = geometry().points ?? [];
    expect(packed).toHaveLength(48);
    for (let i = 0; i < 16; i++) {
        const first = packed[3 * i].position[1]; const second = packed[3 * i + 1].position[1]; const code = packed[3 * i + 2].position[1];
        expect(first + second).toBeLessThanOrEqual(1);
        expect(code).toBe(first ? 1 : second ? 2 : 0);
    }
    expect(screen.getByText(/48\/48 rows decode exactly/)).toBeDefined();
    expect(metric('Query prediction')).toBe(prediction);
});
