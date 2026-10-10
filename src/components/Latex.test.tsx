// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import Latex from './Latex';

afterEach(cleanup);
test('local math rendering exposes MathML and updates without a CDN script', () => {
    const { container, rerender } = render(<Latex formula="x^2" />);
    expect(container.querySelector('math')).not.toBeNull();
    expect(container.querySelector('annotation')?.textContent).toBe('x^2');
    rerender(<Latex formula="y^3" display />);
    expect(container.querySelector('annotation')?.textContent).toBe('y^3');
    expect(container.querySelector('.katex-display')).not.toBeNull();
    expect(document.querySelector('script[src*="cdn"]')).toBeNull();
});
test('malformed and untrusted expressions do not create executable links', () => {
    const { container, rerender } = render(<Latex formula="\\invalidcommand" />);
    expect(container.textContent).toContain('invalidcommand');
    rerender(<Latex formula="\\href{javascript:alert(1)}{click}" />);
    expect(container.querySelector('a')).toBeNull();
});
