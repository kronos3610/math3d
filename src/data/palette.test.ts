import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { paletteTokens } from './palette';

test('CSS and Three.js semantic palette stay identical', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    for (const [token, value] of Object.entries(paletteTokens)) {
        expect(css.match(new RegExp(`${token}:\\s*(#[a-fA-F0-9]{6})\\s*;`))?.[1]).toBe(value);
    }
});

test('shared scene utilities have no independent hex palette', () => {
    const folder = new URL('../components/3d/', import.meta.url);
    for (const file of readdirSync(folder).filter(name => /\.tsx?$/.test(name) && !name.includes('.test.'))) {
        expect(readFileSync(new URL(file, folder), 'utf8'), file).not.toMatch(/#[a-fA-F0-9]{6}\b/);
    }
});
