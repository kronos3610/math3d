import { PerspectiveCamera, Vector3 } from 'three';
import { expect, test } from 'vitest';
import { perspectiveFitDistance } from '../../components/3d/camera-fit';
import { constraintViewGeometry } from './constraintViewModel';
import { QUADRATIC_CENTER, quadraticWeightLoss, weightNorm, type BudgetNorm } from './regularizationModel';

test.each(['ridge', 'lasso'] as BudgetNorm[])('%s views retain the exact solution and fit the current feasible shape and contour', norm => {
    for (const budget of [0.1, 1.5, 3, 8]) {
        const detail = constraintViewGeometry(norm, budget, 'detail');
        const full = constraintViewGeometry(norm, budget, 'objective');
        expect(detail.solution).toEqual(full.solution);
        expect(detail.loss).toBe(full.loss);
        expect(weightNorm(detail.solution, norm)).toBeLessThanOrEqual(budget + 1e-12);
        for (let axis = 0; axis < 3; axis++) {
            expect(detail.bounds.minimum[axis]).toBeLessThanOrEqual(-budget - detail.markerRadius);
            expect(detail.bounds.maximum[axis]).toBeGreaterThanOrEqual(budget + detail.markerRadius);
            expect(full.bounds.minimum[axis]).toBeLessThanOrEqual(QUADRATIC_CENTER[axis] - full.contourRadii[axis]);
            expect(full.bounds.maximum[axis]).toBeGreaterThanOrEqual(QUADRATIC_CENTER[axis] + full.contourRadii[axis]);
            expect(full.bounds.maximum[axis]).toBeGreaterThanOrEqual(full.axisLabelPosition);
            const contourPoint = [...QUADRATIC_CENTER];
            contourPoint[axis] += full.contourRadii[axis];
            expect(quadraticWeightLoss(contourPoint as [number, number, number])).toBeCloseTo(full.loss, 12);
        }
        if (budget === 8) {
            expect(detail.solution).toEqual(QUADRATIC_CENTER);
            expect(detail.loss).toBe(0);
            expect(detail.contourRadii).toEqual([0, 0, 0]);
        }
    }
});

test('detail scale follows the current budget, and the overview does not fit a future maximum budget', () => {
    const small = constraintViewGeometry('ridge', 0.1, 'detail');
    const normal = constraintViewGeometry('ridge', 1.5, 'detail');
    expect(normal.axisExtent / small.axisExtent).toBeCloseTo(15, 12);
    expect(normal.cropLimit / small.cropLimit).toBeCloseTo(15, 12);
    expect(constraintViewGeometry('ridge', 1.5, 'objective').bounds.maximum[0]).toBeLessThan(7);
});

function fittedCamera(norm: BudgetNorm, budget: number, view: 'detail' | 'objective') {
    const geometry = constraintViewGeometry(norm, budget, view);
    const direction = new Vector3(-9, 6, 10).normalize();
    const distance = perspectiveFitDistance(geometry.bounds, direction.toArray(), geometry.target, 50, 390, 700, 48, [0, 1, 0], 150);
    const camera = new PerspectiveCamera(50, 390 / 700, 0.01, 1000);
    camera.position.copy(direction.multiplyScalar(distance).add(new Vector3(...geometry.target)));
    camera.lookAt(...geometry.target); camera.updateMatrixWorld();
    return { geometry, camera };
}

test('default mobile detail makes the current feasible region prominent within the toolbar-safe viewport', () => {
    const { geometry, camera } = fittedCamera('ridge', 1.5, 'detail');
    const horizontalPixels: number[] = [];
    for (let longitude = 0; longitude < 72; longitude++) for (let latitude = 0; latitude <= 36; latitude++) {
        const phi = longitude * 2 * Math.PI / 72; const theta = latitude * Math.PI / 36;
        const point = new Vector3(1.5 * Math.sin(theta) * Math.cos(phi), 1.5 * Math.cos(theta), 1.5 * Math.sin(theta) * Math.sin(phi)).project(camera);
        horizontalPixels.push((point.x + 1) * 390 / 2);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(1 - 300 / 700 + 1e-12);
    }
    expect(Math.max(...horizontalPixels) - Math.min(...horizontalPixels)).toBeGreaterThan(150);
    const minimum = new Vector3(...geometry.solution).project(camera);
    expect(Math.abs(minimum.x)).toBeLessThan(1 - 96 / 390);
});

test.each(['ridge', 'lasso'] as BudgetNorm[])('%s minimum-budget overview keeps a visible red glyph at the actual solution', norm => {
    const { geometry, camera } = fittedCamera(norm, 0.1, 'objective');
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const center = new Vector3(...geometry.solution);
    const left = center.clone().addScaledVector(right, -geometry.markerRadius).project(camera);
    const rightPoint = center.clone().addScaledVector(right, geometry.markerRadius).project(camera);
    expect((rightPoint.x - left.x) * 390 / 2).toBeGreaterThan(4);
    expect(weightNorm(geometry.solution, norm)).toBeCloseTo(0.1, 12);
});
