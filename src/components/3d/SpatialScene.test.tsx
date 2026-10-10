// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SpatialScene, type SpatialSceneProps } from './SpatialScene';

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const model: SpatialSceneProps = {
    description: 'A measured displacement and its model surface.',
    axes: ['Feature one', 'Prediction', 'Feature two'],
    points: [{ position: [0, 0, 0], label: 'Origin' }, { position: [2, 4, -2], color: '#fb7185', label: 'Observation' }],
    paths: [{ points: [[0, 0, 0], [2, 4, -2]], color: '#fbbf24', dashed: true }],
    vectors: [{ from: [0, 0, 0], to: [2, 4, -2], label: 'Displacement' }],
    boxes: [{ position: [1, 2, -1], size: [1, 1, 1], label: 'Region' }],
    surfaces: [{ vertices: [[0, 0, 0], [2, 0, 0], [0, 4, -2], [2, 4, -2]], columns: 2 }],
};

test('WebGL failure preserves a labeled SVG visualization of every computed primitive', () => {
    const { container } = render(<SpatialScene {...model} />);
    const projection = screen.getByRole('img', { name: /Spatial model — 2D projection/ });
    expect(projection.tagName.toLowerCase()).toBe('svg');
    expect(projection.textContent).toContain(model.description);
    expect(projection.textContent).toContain('same computed coordinates');
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelectorAll('svg > g path, svg > path')).toHaveLength(9);
    const annotations = [...container.querySelectorAll('svg > text')].map(label => label.textContent);
    expect(annotations).toContain('Origin');
    // Coincident point/vector labels share one readable annotation.
    expect(annotations).toContain('Observation / Displacement');
    expect(annotations).toContain('Region');
    expect(container.querySelectorAll('svg > text')).toHaveLength(3);
    const dashed = container.querySelector('path[stroke="#fbbf24"]');
    expect(dashed?.getAttribute('stroke-dasharray')).toBe('6 4');
    const arrow = container.querySelector('path[marker-end]');
    const marker = container.querySelector('marker');
    expect(arrow?.getAttribute('marker-end')).toBe(`url(#${marker?.id})`);
    expect(marker?.getAttribute('orient')).toBe('auto-start-reverse');
    expect(marker?.querySelector('path')?.getAttribute('fill')).toBe('context-stroke');
    expect(screen.getByLabelText('Coordinate axes').textContent).toContain('Feature one');
    const firstRange = screen.getByLabelText('Coordinate axes').querySelector('small')?.textContent ?? '';
    expect(firstRange.split('…').map(Number)).toEqual([0, 2]);
    expect(container.querySelector('figcaption')?.textContent).toBe('2D projection · identical model calculations');
});

test('the fallback plots normalized model coordinates and updates when the model changes', () => {
    const { container, rerender } = render(<SpatialScene description="Two observations" points={model.points} />);
    const circles = container.querySelectorAll('circle');
    // A 4-unit maximum span gives an isotropic scale of 7/4 and center (1,2,-1).
    // The front oblique projection is (400 + 48x + 25z, 240 - 48y - 15z).
    expect(Number(circles[0].getAttribute('cx'))).toBeCloseTo(359.75);
    expect(Number(circles[0].getAttribute('cy'))).toBeCloseTo(381.75);
    expect(Number(circles[1].getAttribute('cx'))).toBeCloseTo(440.25);
    expect(Number(circles[1].getAttribute('cy'))).toBeCloseTo(98.25);

    rerender(<SpatialScene description="Moved observation" points={[{ position: [0, 0, 0] }, { position: [4, 4, -2] }]} />);
    const changed = container.querySelectorAll('circle');
    expect(Number(changed[1].getAttribute('cx'))).toBeCloseTo(524.25);
    expect(Number(changed[1].getAttribute('cy'))).toBeCloseTo(98.25);
    expect(screen.getByRole('img').textContent).toContain('Moved observation');
});

test('an empty model still exposes a finite projection and meaningful axis descriptions', () => {
    const { container } = render(<SpatialScene description="No observations have been added." axes={['Time', 'State', 'Channel']} />);
    expect(screen.getByRole('img').textContent).toContain('No observations have been added.');
    expect(container.querySelectorAll('circle, svg > g path, svg > path')).toHaveLength(0);
    expect(screen.getByLabelText('Coordinate axes').textContent).toContain('Time');
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
});

test('multiple fallbacks keep their accessible descriptions and arrow references separate', () => {
    const { container } = render(<>
        <SpatialScene description="First experiment" vectors={[{ from: [0, 0, 0], to: [1, 0, 0], label: 'First vector' }]} />
        <SpatialScene description="Second experiment" vectors={[{ from: [0, 0, 0], to: [0, 1, 0], label: 'Second vector' }]} />
    </>);
    const projections = screen.getAllByRole('img');
    expect(projections[0].textContent).toContain('First experiment');
    expect(projections[0].textContent).not.toContain('Second experiment');
    expect(projections[1].textContent).toContain('Second experiment');
    const markers = container.querySelectorAll('marker');
    expect(markers[0].id).not.toBe(markers[1].id);
    projections.forEach((projection, index) => {
        expect(projection.querySelector('path[marker-end]')?.getAttribute('marker-end')).toBe(`url(#${markers[index].id})`);
    });
});
test('nearby annotations are readable as a marked group without moving the model points', () => {
    const { container } = render(<SpatialScene description="Nearly identical gate endpoints" points={[
        {position:[0,0,0],label:'Zero'},
        {position:[0.0001,0,0],label:'Exposed hidden'},
        {position:[0.04,0,0],label:'Cell memory'},
    ]} />);
    const annotations = container.querySelectorAll('svg > text');
    expect(annotations).toHaveLength(2);
    expect(annotations[0].textContent).toBe('Nearby: Zero / Exposed hidden');
    expect(annotations[0].querySelectorAll('tspan')).toHaveLength(2);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(3);
    expect(Number(circles[1].getAttribute('cx'))).not.toBe(Number(circles[0].getAttribute('cx')));
});
