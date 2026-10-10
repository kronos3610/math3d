// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import Eigenvalues from './Eigenvalues';
import MatrixTransformations from './MatrixTransformations';
import SimpleTest from './SimpleTest';

vi.mock('../../components/3d/SpatialScene', () => ({ SpatialScene: ({ description }: { description: string }) => <div role="img" aria-label={description} /> }));
afterEach(cleanup);
function show(id: string, Scene: typeof Eigenvalues) {
    render(<MemoryRouter initialEntries={[`/linear-algebra/${id}`]}><Routes><Route path="/:topicId/:subtopicId" element={<Scene />} /></Routes></MemoryRouter>);
    const open = screen.queryByRole('button', { name: 'Open scene panel' }); if (open) fireEvent.click(open);
}

test('eigenvector assessment stays available without a renderer and rejects a zero input', () => {
    show('eigenvalues', Eigenvalues);
    fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    expect(screen.getByText('Estimated eigenvalue λ = 1.00')).toBeDefined();
    ['X', 'Y', 'Z'].forEach(axis => fireEvent.change(screen.getByLabelText(`Input vector ${axis}`), { target: { value: '0' } }));
    expect(screen.queryByText(/Estimated eigenvalue/)).toBeNull();
    expect(screen.getByText(/undefined for a zero input/)).toBeDefined();
});

test('clearing a matrix entry retains finite geometry and the actual value until the edit is completed', () => {
    show('eigenvalues', Eigenvalues);
    const entry = screen.getByLabelText('Matrix entry row 1 column 1') as HTMLInputElement;
    fireEvent.change(entry, { target: { value: '' } });
    expect(entry.value).toBe(''); expect(document.body.textContent).not.toContain('NaN');
    fireEvent.blur(entry); expect(entry.value).toBe('2');
    fireEvent.change(entry, { target: { value: '-2' } });
    fireEvent.change(screen.getByLabelText('Input vector Y'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Input vector Z'), { target: { value: '0' } });
    expect(screen.getByText('Estimated eigenvalue λ = -2.00')).toBeDefined();
});

test('matrix preset changes actual determinant and selected cube-corner output', () => {
    show('matrix-transformations', MatrixTransformations);
    const select = screen.getByLabelText('Transformation preset');
    fireEvent.change(select, { target: { value: 'flatten' } });
    expect(screen.getByText('(1.00, 1.00, 0.00)')).toBeDefined();
    expect(screen.getByText(/This matrix is singular/)).toBeDefined();
    fireEvent.change(select, { target: { value: 'reflection' } });
    expect(screen.getByText('(-1.00, 1.00, 1.00)')).toBeDefined();
    expect(screen.getByText(/Orientation is reversed/)).toBeDefined();
});

test('coordinate exploration selects actual fixed cube corners without requiring WebGL', () => {
    show('simple-test', SimpleTest);
    fireEvent.change(screen.getByLabelText('Select cube corner'), { target: { value: '0' } });
    expect(screen.getAllByText('-1')).toHaveLength(3);
    expect(screen.getByText(/Orbiting the camera changes the view/)).toBeDefined();
});
