// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import SubtopicView from '../../components/SubtopicView';

afterEach(cleanup);

const controlNames = ['Spam before filtering', 'Spam caught by the filter', 'Ordinary emails wrongly flagged'] as const;

async function renderLesson() {
    render(<MemoryRouter initialEntries={['/probability/bayes-theorem']}>
        <Routes><Route path="/:topicId/:subtopicId" element={<SubtopicView />} /></Routes>
    </MemoryRouter>);
    await screen.findByRole('slider', { name: controlNames[0] });
}

function posteriorPercent(): number {
    return Number.parseFloat(screen.getByLabelText('Chance of spam after a flag').textContent ?? '');
}

function changeControl(name: typeof controlNames[number], value: number) {
    fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } });
}

test('the actual Bayes route presents the worked email story and its 50% result without WebGL', async () => {
    await renderLesson();
    expect(posteriorPercent()).toBe(50);
    const diagram = screen.getByRole('figure', { name: 'How the filter splits 1,000 emails' });
    expect(diagram.textContent).toMatch(/100\s*spam/i);
    expect(diagram.textContent).toMatch(/900\s*ordinary/i);
    expect(within(diagram).getAllByText('90')).toHaveLength(2);
    expect(screen.getByText('180 flagged emails').parentElement?.textContent).toMatch(/90 spam \+ 90 ordinary = 180 flagged emails/);
    expect(screen.getByRole('region', { name: 'Connect the story to the formula' }).textContent).toMatch(/given.*focus only on the group/i);
    const dictionaryTerms = screen.getAllByRole('term').map(term => term.textContent);
    for (const term of ['Prior', 'Likelihood', 'Evidence', 'Posterior']) {
        expect(dictionaryTerms).toContainEqual(expect.stringMatching(new RegExp(term, 'i')));
    }
    expect(document.querySelector('canvas')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/probability');
});

test('rare spam changes both the worked counts and the probability to about 8.3%', async () => {
    await renderLesson();
    fireEvent.click(screen.getByRole('button', { name: 'Rare spam' }));
    expect((screen.getByRole('slider', { name: controlNames[0] }) as HTMLInputElement).value).toBe('1');
    expect(posteriorPercent()).toBeCloseTo(8.3, 1);
    const diagram = screen.getByRole('figure', { name: 'How the filter splits 1,000 emails' });
    expect(diagram.textContent).toMatch(/10\s*spam/i);
    expect(diagram.textContent).toMatch(/990\s*ordinary/i);
    expect(within(diagram).getByText('9')).toBeDefined();
    expect(within(diagram).getByText('99')).toBeDefined();
    expect(screen.getByText('108 flagged emails').parentElement?.textContent).toMatch(/9 spam \+ 99 ordinary = 108 flagged emails/);
});

test('removing false alarms gives 100% and zero flags makes conditioning undefined', async () => {
    await renderLesson();
    fireEvent.click(screen.getByRole('button', { name: 'No false alarms' }));
    expect((screen.getByRole('slider', { name: controlNames[2] }) as HTMLInputElement).value).toBe('0');
    expect(posteriorPercent()).toBe(100);
    changeControl(controlNames[1], 0);
    const result = screen.getByLabelText('Chance of spam after a flag');
    expect(result.textContent).toMatch(/undefined|no flags|no flagged/i);
    expect(Number.isNaN(posteriorPercent())).toBe(true);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
});

test('reset restores all three inputs, the original counts, and the posterior', async () => {
    await renderLesson();
    fireEvent.click(screen.getByRole('button', { name: 'Rare spam' }));
    fireEvent.click(screen.getByRole('button', { name: 'No false alarms' }));
    changeControl(controlNames[1], 25);
    fireEvent.click(screen.getByRole('button', { name: 'Reset example' }));
    const values = controlNames.map(name => (screen.getByRole('slider', { name }) as HTMLInputElement).value);
    expect(values).toEqual(['10', '90', '10']);
    expect(posteriorPercent()).toBe(50);
    expect(screen.getByText('180 flagged emails')).toBeDefined();
});

test('all sliders are labeled, keyboard focusable, and use valid percentage limits', async () => {
    await renderLesson();
    for (const name of controlNames) {
        const control = screen.getByRole('slider', { name }) as HTMLInputElement;
        expect(control.type).toBe('range');
        expect(control.min).toBe('0');
        expect(control.max).toBe('100');
        expect(control.step).toBe('1');
        control.focus();
        expect(document.activeElement).toBe(control);
    }
    changeControl(controlNames[0], 0);
    expect(posteriorPercent()).toBe(0);
    changeControl(controlNames[0], 100);
    expect(posteriorPercent()).toBe(100);
});

test('the same loaded lesson retains Guide and an Explain tab with the Bayes formula', async () => {
    await renderLesson();
    fireEvent.click(screen.getByRole('button', { name: 'Open scene panel' }));
    expect(screen.getByRole('tab', { name: 'Guide' })).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Explain' }));
    const panel = screen.getByRole('tabpanel', { name: 'Explain' });
    expect(within(panel).getByText('P(A | B) = P(B | A) × P(A) / P(B)')).toBeDefined();
    expect(within(panel).getByText(/A means “the email is spam” and B means “the email is flagged”/)).toBeDefined();
});

test('small positive chances retain precision instead of being presented as impossible events', async () => {
    await renderLesson();
    changeControl(controlNames[0], 1);
    changeControl(controlNames[1], 1);
    changeControl(controlNames[2], 0);
    expect(posteriorPercent()).toBe(100);
    const evidenceTerm = screen.getAllByRole('term').find(term => term.textContent?.startsWith('Evidence'));
    expect(evidenceTerm?.nextElementSibling?.textContent).toMatch(/0\.01%|<0\.1%/);
    changeControl(controlNames[2], 100);
    expect(screen.getByLabelText('Chance of spam after a flag').textContent).toMatch(/0\.01%|<0\.1%/);
});
