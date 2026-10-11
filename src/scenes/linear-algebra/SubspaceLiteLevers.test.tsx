// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import FundamentalSubspacesLite from './FundamentalSubspacesLite';

vi.mock('../../components/3d/SpatialScene', () => ({ SpatialScene: ({ description }: { description: string }) => <div role="img" aria-label={description} /> }));
afterEach(cleanup);
const metric = (label: string) => [...document.querySelectorAll('.visual-lab-metrics > div')].find(e => e.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;

test('the input lever changes both components; a nonzero null input has zero image and row component', () => {
    render(<MemoryRouter initialEntries={['/linear-algebra/fundamental-subspaces-lite']}><Routes><Route path="/:topicId/:subtopicId" element={<FundamentalSubspacesLite />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(metric('Row part xᵣ')).toBe('(1.00, 4.00, 2.00)');
    fireEvent.change(screen.getByRole('slider', { name: 'Input x1' }), { target: { value: '4' } });
    expect(metric('Row part xᵣ')).not.toBe('(1.00, 4.00, 2.00)');
    expect(metric('xᵣ · xₙ')).toBe('0.000');
    expect(metric('Reconstruction error')).toBe('0.000');
    fireEvent.click(screen.getByRole('button', { name: 'Reveal a null direction' }));
    expect(metric('Row part xᵣ')).toBe('(0.00, 0.00, 0.00)');
    expect(metric('Null part xₙ')).toBe('(2.00, -1.00, 1.00)');
    expect(metric('Ax')).toBe('(0.00, 0.00, 0.00)');
    fireEvent.click(screen.getByRole('button', { name: 'Reset input' }));
    expect(metric('Ax')).toBe('(9.00, 6.00, 15.00)');
});
