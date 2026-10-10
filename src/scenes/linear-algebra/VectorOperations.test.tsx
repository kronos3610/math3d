// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { create } from '@react-three/test-renderer';
import { MemoryRouter } from 'react-router-dom';
import * as THREE from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import VectorOperations, { VectorAdditionScene } from './VectorOperations';

// R3F's Node test renderer uses the CommonJS Three build. Keep object constructors
// identical in this test so quaternion.copy follows the same path as Vite in-browser.
vi.mock('three', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('three');
});

// DOM controls do not need a GPU; geometry tests below still render real Arrow meshes.
vi.mock('../../components/3d/SceneCanvas', () => ({
    SceneCanvas: (props: { 'aria-label'?: string; frameloop?: string }) =>
        <div role="img" aria-label={props['aria-label']} data-frameloop={props.frameloop} />,
}));
// Only HTML portals are substituted in the Three.js test-renderer environment.
vi.mock('../../components/3d/Label', () => ({
    Label: ({ text, position }: { text: string; position: [number, number, number] }) =>
        <group name={`label-${text}`} position={position} />,
}));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

afterEach(cleanup);

test('labeled vector controls update the component-wise sum and reset it', () => {
    render(<MemoryRouter><VectorOperations /></MemoryRouter>);
    for (const vector of ['A', 'B']) {
        for (const axis of ['X', 'Y', 'Z']) {
            expect(screen.getByRole('slider', { name: `${vector} ${axis}` })).toBeDefined();
        }
    }
    const sum = screen.getByLabelText('Vector sum A plus B');
    expect(sum.textContent).toBe('A + B = (2.0, 3.0, 1.0)');
    fireEvent.change(screen.getByRole('slider', { name: 'A X' }), { target: { value: '-1.5' } });
    fireEvent.change(screen.getByRole('slider', { name: 'B Z' }), { target: { value: '-2' } });
    expect(sum.textContent).toBe('A + B = (-1.5, 3.0, -2.0)');
    expect(screen.getByRole('img').getAttribute('data-frameloop')).toBe('demand');
    fireEvent.click(screen.getByRole('button', { name: 'Reset Vectors' }));
    expect(sum.textContent).toBe('A + B = (2.0, 3.0, 1.0)');
});

test('cancellation remains readable when the resultant arrow has zero length', () => {
    render(<MemoryRouter><VectorOperations /></MemoryRouter>);
    for (const [axis, value] of [['X', '-2'], ['Y', '-1'], ['Z', '0']]) {
        fireEvent.change(screen.getByRole('slider', { name: `B ${axis}` }), { target: { value } });
    }
    expect(screen.getByLabelText('Vector sum A plus B').textContent).toBe('A + B = (0.0, 0.0, 0.0)');
    expect(screen.getByText('The vectors cancel: their combined move is zero.')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Explain' }));
    expect(screen.getByText(/Try B = −A/)).toBeDefined();
});

test('real arrow-head tips reach A, B, and the component-wise sum after changing vectors', async () => {
    const renderer = await create(<VectorAdditionScene vecA={[2, 1, 0]} vecB={[0, 2, 1]} />);
    const expectTip = (groupName: string, expected: [number, number, number]) => {
        const heads = renderer.scene.findByProps({ name: groupName }).findAllByType('Mesh');
        expect(heads).toHaveLength(1);
        const head = heads[0].instance as THREE.Mesh<THREE.ConeGeometry>;
        head.updateWorldMatrix(true, false);
        const tip = head.localToWorld(new THREE.Vector3(0, head.geometry.parameters.height / 2, 0));
        expected.forEach((coordinate, index) => expect(tip.getComponent(index)).toBeCloseTo(coordinate, 10));
    };
    try {
        expectTip('vector-a', [2, 1, 0]);
        expectTip('vector-b', [0, 2, 1]);
        expectTip('vector-sum', [2, 3, 1]);
        await renderer.update(<VectorAdditionScene vecA={[-2, 1, 3]} vecB={[1, -2, -1]} />);
        expectTip('vector-a', [-2, 1, 3]);
        expectTip('vector-b', [1, -2, -1]);
        expectTip('vector-sum', [-1, -1, 2]);
        await renderer.update(<VectorAdditionScene vecA={[-2, 1, 3]} vecB={[2, -1, -3]} />);
        expect(renderer.scene.findByProps({ name: 'vector-sum' }).findAllByType('Mesh')).toHaveLength(0);
        expect(renderer.scene.findByProps({ name: 'label-A + B = 0' })).toBeDefined();
    } finally {
        await renderer.unmount();
    }
});
