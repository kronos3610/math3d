// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import LinearModels from './LinearModels';

afterEach(cleanup);

test('changing algorithms identifies the selected model and preserves the training examples', () => {
    render(<MemoryRouter><LinearModels /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Selected model: Logistic regression' })).toBeDefined();
    expect(screen.getByText('24 (12 blue, 12 red)')).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Learning algorithm' }), { target: { value: 'least-squares' } });
    expect(screen.getByRole('heading', { name: 'Selected model: Least squares classification' })).toBeDefined();
    expect(screen.getByText(/The raw prediction is a numeric score/)).toBeDefined();
    expect(screen.getByText('24 (12 blue, 12 red)')).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Learning algorithm' }), { target: { value: 'perceptron' } });
    expect(screen.getByRole('heading', { name: 'Selected model: Perceptron' })).toBeDefined();
    expect(screen.getByText(/The sign of the score selects a class/)).toBeDefined();
});

test('keyboard movement and Enter/Space add the chosen class at the cursor', () => {
    render(<MemoryRouter><LinearModels /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Clear points' }));
    const plot = screen.getByRole('application', { name: 'Interactive classification plot' });
    plot.focus();
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    fireEvent.keyDown(plot, { key: 'ArrowUp' });
    expect(screen.getByText(/Cursor: x₁ = 0.10, x₂ = 0.10/)).toBeDefined();
    fireEvent.keyDown(plot, { key: 'Enter' });
    expect(screen.getByText('1 (1 blue, 0 red)')).toBeDefined();
    const redButton = screen.getByRole('button', { name: /Red class C₂/ });
    fireEvent.click(redButton);
    expect(redButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(plot, { key: 'Home' });
    fireEvent.keyDown(plot, { key: ' ' });
    expect(screen.getByText('2 (1 blue, 1 red)')).toBeDefined();
    expect(screen.queryByText('Add at least one point from each class to compare a decision boundary.')).toBeNull();
});

test('pointer clicks map both features correctly and can place points on a vertical boundary', () => {
    render(<MemoryRouter><LinearModels /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Clear points' }));
    const plot = screen.getByRole('application', { name: 'Interactive classification plot' });
    plot.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 800, height: 440, right: 800, bottom: 440, toJSON: () => ({}) });
    fireEvent.click(plot, { clientX: 431, clientY: 207.5 });
    expect(screen.getByText(/Cursor: x₁ = 0.00, x₂ = 0.00/)).toBeDefined();
    expect(screen.getByText('1 (1 blue, 0 red)')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Red class C₂/ }));
    fireEvent.click(plot, { clientX: 88, clientY: 207.5 });
    expect(screen.getByText(/Cursor: x₁ = -1.00, x₂ = 0.00/)).toBeDefined();
    expect(screen.getByText('2 (1 blue, 1 red)')).toBeDefined();
    expect(plot.innerHTML).not.toContain('Infinity');
    expect(plot.innerHTML).not.toContain('NaN');
});
