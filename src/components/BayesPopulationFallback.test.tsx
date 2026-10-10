// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import BayesPopulationFallback from './BayesPopulationFallback';
import type { BayesParameters, BayesResult } from '../utils/bayes';

afterEach(cleanup);

const defaultParameters: BayesParameters = { prior: 0.1, likelihood: 0.9, falsePositiveRate: 0.1 };
// Independently known expected counts for the worked example, rather than
// calculating the expectations with the helper that supplies production data.
const defaultResult: BayesResult = {
    eventCount: 100, complementCount: 900,
    eventAndEvidenceCount: 90, nonEventAndEvidenceCount: 90,
    evidenceCount: 180, evidenceProbability: 0.18, posteriorProbability: 0.5,
};

interface RectangleBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

function bounds(rectangle: Element): RectangleBounds {
    return {
        x: Number(rectangle.getAttribute('x') ?? 0),
        y: Number(rectangle.getAttribute('y') ?? 0),
        width: Number(rectangle.getAttribute('width')),
        height: Number(rectangle.getAttribute('height')),
    };
}

function currentDiagram() {
    const diagram = screen.getByRole('img', { name: /Bayes email groups in a 2D probability diagram/ });
    const outlines = Array.from(diagram.querySelectorAll('rect[fill="none"]'));
    const colors = Array.from(diagram.querySelectorAll('rect[fill="var(--bayes-spam)"], rect[fill="var(--bayes-ordinary)"]'));
    return { outlines, colors };
}

function coloredRectanglesInside(outline: Element, colors: Element[]): Element[] {
    const square = bounds(outline);
    return colors.filter(rectangle => {
        const rectangleBounds = bounds(rectangle);
        return rectangleBounds.x >= square.x - 1e-9 && rectangleBounds.y >= square.y - 1e-9
            && rectangleBounds.x + rectangleBounds.width <= square.x + square.width + 1e-9
            && rectangleBounds.y + rectangleBounds.height <= square.y + square.height + 1e-9;
    });
}

function areaFraction(rectangle: Element, outline: Element): number {
    const rectangleBounds = bounds(rectangle);
    const square = bounds(outline);
    return rectangleBounds.width * rectangleBounds.height / (square.width * square.height);
}

function colorFraction(rectangles: Element[], outline: Element, color: 'spam' | 'ordinary'): number {
    return rectangles.filter(rectangle => rectangle.getAttribute('fill') === `var(--bayes-${color})`)
        .reduce((sum, rectangle) => sum + areaFraction(rectangle, outline), 0);
}

function opacity(rectangle: Element): number {
    return Number(rectangle.getAttribute('opacity') ?? 1);
}

test('source areas encode joint probabilities and the enlarged square normalizes only the flagged group', () => {
    render(<BayesPopulationFallback parameters={defaultParameters} result={defaultResult} view="conditional" />);
    const { outlines, colors } = currentDiagram();
    expect(outlines).toHaveLength(2);
    const source = coloredRectanglesInside(outlines[0], colors);
    const selected = coloredRectanglesInside(outlines[1], colors);
    expect(source).toHaveLength(4);
    const flagged = source.filter(rectangle => opacity(rectangle) === 1);
    const unflagged = source.filter(rectangle => opacity(rectangle) < 1);
    expect(colorFraction(flagged, outlines[0], 'spam')).toBeCloseTo(0.09, 12);
    expect(colorFraction(flagged, outlines[0], 'ordinary')).toBeCloseTo(0.09, 12);
    expect(colorFraction(unflagged, outlines[0], 'spam')).toBeCloseTo(0.01, 12);
    expect(colorFraction(unflagged, outlines[0], 'ordinary')).toBeCloseTo(0.81, 12);
    expect(colorFraction(selected, outlines[1], 'spam')).toBeCloseTo(0.5, 12);
    expect(colorFraction(selected, outlines[1], 'ordinary')).toBeCloseTo(0.5, 12);
});

test('rare spam gives 9 versus 99 flags and the selected colored area is 9/108, rather than the catch rate', () => {
    const parameters = { ...defaultParameters, prior: 0.01 };
    const result: BayesResult = {
        eventCount: 10, complementCount: 990,
        eventAndEvidenceCount: 9, nonEventAndEvidenceCount: 99,
        evidenceCount: 108, evidenceProbability: 0.108, posteriorProbability: 9 / 108,
    };
    render(<BayesPopulationFallback parameters={parameters} result={result} view="conditional" />);
    const { outlines, colors } = currentDiagram();
    const flagged = coloredRectanglesInside(outlines[0], colors).filter(rectangle => opacity(rectangle) === 1);
    const selected = coloredRectanglesInside(outlines[1], colors);
    expect(colorFraction(flagged, outlines[0], 'spam')).toBeCloseTo(0.009, 12);
    expect(colorFraction(flagged, outlines[0], 'ordinary')).toBeCloseTo(0.099, 12);
    expect(colorFraction(selected, outlines[1], 'spam')).toBeCloseTo(9 / 108, 12);
    expect(colorFraction(selected, outlines[1], 'ordinary')).toBeCloseTo(99 / 108, 12);
});

test('population and flags stages preserve category areas while deemphasizing only unflagged areas', () => {
    const { rerender } = render(<BayesPopulationFallback parameters={defaultParameters} result={defaultResult} view="population" />);
    const population = currentDiagram();
    expect(population.outlines).toHaveLength(1);
    expect(population.colors.every(rectangle => opacity(rectangle) === 1)).toBe(true);
    expect(colorFraction(population.colors, population.outlines[0], 'spam')).toBeCloseTo(0.1, 12);
    expect(colorFraction(population.colors, population.outlines[0], 'ordinary')).toBeCloseTo(0.9, 12);

    rerender(<BayesPopulationFallback parameters={defaultParameters} result={defaultResult} view="flags" />);
    const flags = currentDiagram();
    expect(flags.outlines).toHaveLength(1);
    const highlighted = flags.colors.filter(rectangle => opacity(rectangle) === 1);
    const dimmed = flags.colors.filter(rectangle => opacity(rectangle) < 1);
    expect(highlighted).toHaveLength(2);
    expect(dimmed).toHaveLength(2);
    expect(colorFraction(highlighted, flags.outlines[0], 'spam')).toBeCloseTo(0.09, 12);
    expect(colorFraction(highlighted, flags.outlines[0], 'ordinary')).toBeCloseTo(0.09, 12);
    expect(dimmed.every(rectangle => opacity(rectangle) > 0)).toBe(true);
    expect(colorFraction(flags.colors, flags.outlines[0], 'spam')).toBeCloseTo(0.1, 12);
    expect(colorFraction(flags.colors, flags.outlines[0], 'ordinary')).toBeCloseTo(0.9, 12);
});

test('zero evidence leaves the selected outline empty instead of inventing a posterior color', () => {
    const parameters = { ...defaultParameters, likelihood: 0, falsePositiveRate: 0 };
    const result: BayesResult = {
        eventCount: 100, complementCount: 900,
        eventAndEvidenceCount: 0, nonEventAndEvidenceCount: 0,
        evidenceCount: 0, evidenceProbability: 0, posteriorProbability: null,
    };
    render(<BayesPopulationFallback parameters={parameters} result={result} view="conditional" />);
    const { outlines, colors } = currentDiagram();
    expect(outlines).toHaveLength(2);
    const source = coloredRectanglesInside(outlines[0], colors);
    expect(source.filter(rectangle => opacity(rectangle) === 1).reduce((sum, rectangle) => sum + areaFraction(rectangle, outlines[0]), 0)).toBe(0);
    expect(coloredRectanglesInside(outlines[1], colors)).toHaveLength(0);
    expect(colorFraction(source, outlines[0], 'spam')).toBeCloseTo(0.1, 12);
    expect(colorFraction(source, outlines[0], 'ordinary')).toBeCloseTo(0.9, 12);
});
