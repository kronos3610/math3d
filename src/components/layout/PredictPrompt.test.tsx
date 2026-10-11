// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { PredictPrompt } from './PredictPrompt';

afterEach(() => { cleanup(); window.localStorage.clear(); });

test('keyboard-native choice locks, announces feedback and focuses the reveal', async () => {
    render(<PredictPrompt question="What happens?" options={['Converges', 'Diverges']} correct={1} explanation="The distance grows." />);
    expect(screen.getByRole('button', { name: 'Lock in' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Diverges' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(screen.getByRole('status').textContent).toContain('Your prediction matches.');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('status')));
});

test('parameter changes reset the prediction and use the computed answer', () => {
    const { rerender } = render(<PredictPrompt contextKey="small" question="Result?" options={['Small', 'Large']} correct={0} explanation="Small." />);
    fireEvent.click(screen.getByRole('radio', { name: 'Small' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    rerender(<PredictPrompt contextKey="large" question="Result?" options={['Small', 'Large']} correct={1} explanation="Large." />);
    expect(screen.getByRole('radio', { name: 'Small' })).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Small' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(screen.getByRole('status').textContent).toContain('The result is Large.');
});

test('skip reveals without requiring an answer and dismissal is optional', () => {
    let reveals = 0;
    const props = { question: 'Guess?', options: ['Yes', 'No'], correct: 0, explanation: 'Yes.', persistenceKey: 'test', onReveal: () => reveals++ };
    const { unmount } = render(<PredictPrompt {...props} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Don’t ask again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip prediction' }));
    expect(reveals).toBe(1);
    unmount();
    render(<PredictPrompt {...props} />);
    expect(screen.getByRole('button', { name: 'Try a prediction' })).toBeDefined();
});
