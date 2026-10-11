// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import type { ComponentType } from 'react';
import SigmaAlgebra from './SigmaAlgebra';
import LebesgueMeasure from './LebesgueMeasure';
import JacobianHessian from './JacobianHessian';
import TaylorRemainder from './TaylorRemainder';
import LpRegularization from '../ml/LpRegularization';
import LagrangeMultipliers from '../ml/LagrangeMultipliers';
import LogLikelihood from '../probability/LogLikelihood';
import ProbabilityVsLikelihood from '../probability/ProbabilityVsLikelihood';

vi.mock('../../components/3d/SpatialScene', () => ({ SpatialScene: ({ description }: { description: string }) => <div role="img" aria-label={description} /> }));
vi.mock('../../components/3d/SceneCanvas', () => ({ SceneCanvas: (props: { 'aria-label'?: string }) => <div role="img" aria-label={props['aria-label']} /> }));
afterEach(cleanup);
function show(topic: string, id: string, Scene: ComponentType) {
    render(<MemoryRouter initialEntries={[`/${topic}/${id}`]}><Routes><Route path="/:topicId/:subtopicId" element={<Scene />} /></Routes></MemoryRouter>);
}
const cases = [
    { topic: 'calculus', id: 'sigma-algebra', Scene: SigmaAlgebra, lever: 'Granularity Level' },
    { topic: 'calculus', id: 'lebesgue-measure', Scene: LebesgueMeasure, lever: 'Dimension' },
    { topic: 'calculus', id: 'jacobian-hessian', Scene: JacobianHessian, lever: 'Coordinate X' },
    { topic: 'calculus', id: 'taylor-remainder', Scene: TaylorRemainder, lever: 'Degree' },
    { topic: 'ml', id: 'lp-regularization', Scene: LpRegularization, lever: 'Radius / budget' },
    { topic: 'ml', id: 'lagrange-multipliers', Scene: LagrangeMultipliers, lever: 'Position on Path' },
    { topic: 'probability', id: 'log-likelihood', Scene: LogLikelihood, lever: 'Spread' },
];

test.each(cases)('$id exposes its key, lever, measurements, and challenge before opening the panel', ({ topic, id, Scene, lever }) => {
    show(topic, id, Scene);
    expect(screen.getByRole('list', { name: 'Plot key' })).toBeDefined();
    expect(screen.getByRole('slider', { name: lever })).toBeDefined();
    expect(document.querySelector('.visual-lab-metrics')).not.toBeNull();
    expect(document.querySelector('.visual-lab-challenge')?.textContent).toContain('Try:');
    expect(screen.getByRole('button', { name: 'Open scene panel' })).toBeDefined();
});

test('finite sigma-algebra counts unions of whole atoms and preserves the universe under complement', () => {
    show('calculus', 'sigma-algebra', SigmaAlgebra);
    fireEvent.change(screen.getByRole('slider', { name: 'Granularity Level' }), { target: { value: '4' } });
    expect(screen.getByText('65536')).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Closure rule' }), { target: { value: 'complement' } });
    expect(screen.getByText(/A contains 1 outcome. Its complement contains the other 15/)).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Closure rule' }), { target: { value: 'union' } });
    expect(screen.getByText(/A ∪ B contains 2 outcomes/)).toBeDefined();
});

test('the covering readout improves with the same tested nested ellipsoid grid', () => {
    show('calculus', 'lebesgue-measure', LebesgueMeasure);
    fireEvent.change(screen.getByRole('combobox', { name: 'Measure experiment' }), { target: { value: '1' } });
    const values = () => within(document.querySelector('.visual-lab-metrics') as HTMLElement).getAllByRole('definition').map(element => Number(element.textContent));
    const coarse = values();
    fireEvent.change(screen.getByRole('slider', { name: 'Box Resolution' }), { target: { value: '3' } });
    const fine = values();
    expect(fine[0]).toBeLessThan(coarse[0]); expect(fine[0]).toBeGreaterThan(fine[1]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Measure experiment' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Cover Thickness' }), { target: { value: '3' } });
    expect(screen.getByText('0.64')).toBeDefined();
});

test('constrained path minimum readout uses the true objective and multiplier', () => {
    show('ml', 'lagrange-multipliers', LagrangeMultipliers);
    fireEvent.change(screen.getByRole('slider', { name: 'Position on Path' }), { target: { value: '0.5' } });
    expect(screen.getByText('8.00')).toBeDefined(); expect(screen.getAllByText('4.00')).toHaveLength(2);
    expect(screen.getByText(/At \(2, 2\), f = 8 and/)).toBeDefined();
});

test('likelihood changes the varied axis while retaining the same normalized density score', () => {
    show('probability', 'probability-vs-likelihood', ProbabilityVsLikelihood);
    expect(screen.getByRole('list', { name: 'Plot key' })).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'likelihood' } });
    expect(screen.getByText('b = 4.5')).toBeDefined(); expect(screen.getByText('x = 3')).toBeDefined();
    expect(screen.getByText(/not a probability distribution over x/)).toBeDefined();
});

test('Gaussian spread updates the exact all-observation score, even with no renderer', () => {
    show('probability', 'log-likelihood', LogLikelihood);
    const values = () => document.querySelector('.visual-lab-metrics')?.textContent;
    const initial = values();
    fireEvent.change(screen.getByRole('slider', { name: 'Spread' }), { target: { value: '0.1' } });
    expect(values()).not.toBe(initial); expect(document.body.textContent).not.toContain('NaN');
    expect(screen.getByText(/none has zero Gaussian density/)).toBeDefined();
});
