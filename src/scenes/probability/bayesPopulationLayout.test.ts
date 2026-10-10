import { describe, expect, test } from 'vitest';
import { createBayesPopulationLayout } from './bayesPopulationLayout';

const example = { prior: 0.1, likelihood: 0.9, falsePositiveRate: 0.1 };

describe('weighted Bayes population layout', () => {
    test('default conditional selection preserves 1000 emails and splits 180 flags equally', () => {
        const layout = createBayesPopulationLayout(example, 'conditional');
        const sum = (predicate: (piece: typeof layout.pieces[number]) => boolean) =>
            layout.pieces.filter(predicate).reduce((total, piece) => total + piece.weight, 0);
        expect(sum(() => true)).toBeCloseTo(1000, 10);
        expect(sum(piece => piece.event)).toBeCloseTo(100, 10);
        expect(sum(piece => !piece.event)).toBeCloseTo(900, 10);
        expect(sum(piece => piece.event && piece.flagged)).toBeCloseTo(90, 10);
        expect(sum(piece => !piece.event && piece.flagged)).toBeCloseTo(90, 10);
        expect(sum(piece => !piece.flagged)).toBeCloseTo(820, 10);
        expect(layout.nominalTileWeight).toBe(1);
        expect(new Set(layout.pieces.map(piece => piece.sourceSlot)).size).toBe(1000);
    });

    test('fractional joint counts become proportional strips rather than rounded emails', () => {
        const layout = createBayesPopulationLayout({ prior: 0.1055, likelihood: 0.333, falsePositiveRate: 0.071 }, 'population');
        const spamFlags = layout.pieces.filter(piece => piece.event && piece.flagged).reduce((sum, piece) => sum + piece.weight, 0);
        const ordinaryFlags = layout.pieces.filter(piece => !piece.event && piece.flagged).reduce((sum, piece) => sum + piece.weight, 0);
        expect(spamFlags).toBeCloseTo(35.1315, 10);
        expect(ordinaryFlags).toBeCloseTo(63.5095, 10);
        expect(layout.pieces.some(piece => piece.fraction < 1 && piece.fraction > 0.001)).toBe(true);
        for (let slot = 0; slot < 1000; slot++) {
            const pieces = layout.pieces.filter(piece => piece.sourceSlot === slot);
            expect(pieces.reduce((sum, piece) => sum + piece.weight, 0)).toBeCloseTo(1, 10);
            expect(pieces.reduce((sum, piece) => sum + piece.scale[0], 0)).toBeCloseTo(0.42, 10);
        }
    });

    test('only flagged pieces move to the conditional board; unflagged pieces remain in source', () => {
        const layout = createBayesPopulationLayout(example, 'conditional');
        const selected = layout.selectedBoard;
        expect(selected).not.toBeNull();
        if (!selected) throw new Error('Expected a selected board.');
        for (const piece of layout.pieces) {
            const destination = piece.flagged ? selected : layout.sourceBoard;
            expect(piece.position[0]).toBeGreaterThanOrEqual(destination.position[0] - destination.width / 2);
            expect(piece.position[0]).toBeLessThanOrEqual(destination.position[0] + destination.width / 2);
            expect(piece.position[1]).toBeGreaterThanOrEqual(destination.position[1] - destination.height / 2);
            expect(piece.position[1]).toBeLessThanOrEqual(destination.position[1] + destination.height / 2);
            expect(piece.scale[1]).toBeCloseTo(piece.flagged ? 0.42 * 1.3 : 0.42, 12);
        }
    });

    test('flag view raises exactly the expected selected weight and keeps every piece in source', () => {
        const layout = createBayesPopulationLayout(example, 'flags');
        expect(layout.selectedBoard).toBeNull();
        expect(layout.pieces.filter(piece => piece.position[2] > 0).reduce((sum, piece) => sum + piece.weight, 0)).toBeCloseTo(180, 10);
        expect(layout.pieces.every(piece => piece.position[2] === (piece.flagged ? 1.1 : 0))).toBe(true);
    });

    test('portrait layouts stack both groups and zero evidence never invents a selected tile', () => {
        const stacked = createBayesPopulationLayout(example, 'conditional', 'vertical');
        expect(stacked.selectedBoard?.position[0]).toBe(0);
        expect(stacked.sourceBoard.position[1]).toBeGreaterThan(stacked.selectedBoard?.position[1] ?? Infinity);
        const noEvidence = createBayesPopulationLayout({ ...example, likelihood: 0, falsePositiveRate: 0 }, 'conditional');
        expect(noEvidence.selectedBoard).toBeNull();
        expect(noEvidence.pieces.some(piece => piece.flagged)).toBe(false);
        expect(noEvidence.pieces.reduce((sum, piece) => sum + piece.weight, 0)).toBeCloseTo(1000, 10);
    });

    test('full selection and zero-prior extremes conserve weights and match the posterior', () => {
        for (const prior of [0, 0.001, 0.2571, 1]) {
            const layout = createBayesPopulationLayout({ prior, likelihood: 1, falsePositiveRate: 1 }, 'conditional');
            expect(layout.pieces.every(piece => piece.flagged)).toBe(true);
            const selectedWeight = layout.pieces.reduce((sum, piece) => sum + piece.weight, 0);
            const selectedSpam = layout.pieces.filter(piece => piece.event).reduce((sum, piece) => sum + piece.weight, 0);
            expect(selectedWeight).toBeCloseTo(1000, 10);
            expect(selectedSpam / selectedWeight).toBeCloseTo(prior, 12);
            expect(layout.pieces.length).toBeLessThanOrEqual(1003);
        }
    });
});
