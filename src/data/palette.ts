/** Semantic colours shared by CSS, SVG and Three.js. Axes are deliberately neutral. */
export const VIZ = {
    data: '#60a5fa', truth: '#64d9c6', focus: '#fbbf24', variation: '#a5b4fc',
    error: '#fb7185', output: '#8b5cf6', axis: '#94a3b8',
    basis1: '#f87171', basis2: '#34d399', basis3: '#60a5fa',
    background: '#0b0f19', surface: '#0f172a', muted: '#475569',
    text: '#e2e8f0', white: '#ffffff', grid: '#1e293b', focusDim: '#a16207',
} as const;

export const paletteTokens = {
    '--viz-data': VIZ.data, '--lab-truth': VIZ.truth, '--viz-focus': VIZ.focus,
    '--lab-variation': VIZ.variation, '--lab-noise': VIZ.error, '--viz-output': VIZ.output,
    '--viz-axis-line': VIZ.axis, '--viz-basis-1': VIZ.basis1,
    '--viz-basis-2': VIZ.basis2, '--viz-basis-3': VIZ.basis3,
} as const;
