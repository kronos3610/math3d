import type { CameraPoint, SceneBounds } from '../../components/3d/camera-fit';
import { QUADRATIC_CENTER, QUADRATIC_CURVATURE, quadraticWeightLoss, solveBudgetQuadratic, type BudgetNorm } from './regularizationModel';

export type ConstraintView = 'detail' | 'objective';
export function constraintViewGeometry(norm: BudgetNorm, budget: number, view: ConstraintView) {
    const solution = solveBudgetQuadratic(norm, budget);
    const loss = quadraticWeightLoss(solution);
    const contourRadii = QUADRATIC_CURVATURE.map(value => Math.sqrt(2 * loss / value)) as [number, number, number];
    const axisExtent = view === 'detail' ? budget * 1.1 : Math.max(budget * 1.1, ...QUADRATIC_CENTER);
    const axisLabelPosition = axisExtent + Math.max(budget, axisExtent) * 0.14;
    // A point glyph must remain visible in an overview of a very small budget.
    // Only its display radius changes; the computed weight coordinates do not.
    const overviewSpan = Math.max(budget * 2, axisLabelPosition, ...contourRadii.map(radius => radius * 2));
    const markerRadius = view === 'detail' ? budget * 0.065 : Math.max(budget * 0.065, overviewSpan * 0.015);
    const cropLimit = axisLabelPosition;
    const detailExtent = axisLabelPosition;
    const bounds: SceneBounds = view === 'detail'
        ? { minimum: [-detailExtent, -detailExtent, -detailExtent], maximum: [detailExtent, detailExtent, detailExtent] }
        : {
            minimum: QUADRATIC_CENTER.map((value, axis) => Math.min(-budget - markerRadius, value - contourRadii[axis])) as [number, number, number],
            maximum: QUADRATIC_CENTER.map((value, axis) => Math.max(budget + markerRadius, axisLabelPosition, value + contourRadii[axis], value + (axis === 1 ? 0.5 : 0.15))) as [number, number, number],
        };
    const target: CameraPoint = view === 'detail' ? [0, 0, 0] : bounds.minimum.map((value, axis) => (value + bounds.maximum[axis]) / 2) as [number, number, number];
    return { solution, loss, contourRadii, markerRadius, axisExtent, axisLabelPosition, cropLimit, bounds, target };
}
