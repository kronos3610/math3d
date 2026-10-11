import { sampleNormal, seededRandom } from '../../utils/regression';

export type BoundaryDataset = 'separable' | 'overlap' | 'xor' | 'shells';
export type BoundaryKind = 'plane' | 'sphere';
export type BoundaryVector = [number, number, number];
export interface BoundaryPoint { position: BoundaryVector; classId: 0 | 1; }
export interface BoundaryParameters { kind: BoundaryKind; tilt: number; turn: number; offset: number; radius: number; }
export function boundaryNormal(tilt: number, turn: number): BoundaryVector {
    if (!Number.isFinite(tilt) || !Number.isFinite(turn)) throw new RangeError('Plane angles must be finite.');
    const a = tilt * Math.PI / 180, b = turn * Math.PI / 180;
    return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
}
export function makeBoundaryDataset(kind: BoundaryDataset, seed = 31, count = 80): BoundaryPoint[] {
    if (!Number.isInteger(count) || count < 4 || count > 1000 || !Number.isFinite(seed)) throw new RangeError('Use a finite seed and 4 to 1000 points.');
    const random = seededRandom(seed);
    return Array.from({ length: count }, (_, index) => {
        const classId = (index % 2) as 0 | 1;
        if (kind === 'separable') {
            const sign = classId ? 1 : -1;
            return { classId, position: [sign * 1.5 + 2 * random() - 1, sign + 2 * random() - 1, 2 * random() - 1] };
        }
        if (kind === 'overlap') {
            const sign = classId ? 1 : -1;
            return { classId, position: [sign * 0.5 + sampleNormal(random) * 0.7, sign * 0.4 + sampleNormal(random) * 0.7, sampleNormal(random) * 0.5] };
        }
        if (kind === 'xor') {
            const quadrant = index % 4;
            const x = (quadrant < 2 ? -1 : 1) * (1.2 + 0.6 * random());
            const y = (quadrant % 2 ? -1 : 1) * (1.2 + 0.6 * random());
            return { classId: x * y > 0 ? 1 : 0, position: [x, y, (random() - 0.5) * 0.7] };
        }
        if (kind !== 'shells') throw new RangeError('Unknown dataset.');
        const z = 2 * random() - 1, angle = 2 * Math.PI * random();
        const radius = classId ? 0.35 + 0.45 * random() : 1.7 + 0.5 * random();
        const horizontal = Math.sqrt(1 - z * z);
        return { classId, position: [radius * horizontal * Math.cos(angle), radius * horizontal * Math.sin(angle), radius * z] };
    });
}
export function boundaryPrediction(point: BoundaryVector, parameters: BoundaryParameters): 0 | 1 {
    if (point.some(value => !Number.isFinite(value)) || !Number.isFinite(parameters.offset) || !Number.isFinite(parameters.radius) || parameters.radius <= 0 || !['plane', 'sphere'].includes(parameters.kind)) throw new RangeError('Boundary coordinates must be finite and sphere radius positive.');
    const normal = boundaryNormal(parameters.tilt, parameters.turn);
    const score = parameters.kind === 'sphere' ? parameters.radius ** 2 - point.reduce((sum, value) => sum + value * value, 0) : point.reduce((sum, value, index) => sum + normal[index] * value, 0) - parameters.offset;
    return score >= 0 ? 1 : 0;
}
export function boundaryAccuracy(points: readonly BoundaryPoint[], parameters: BoundaryParameters) {
    const mistakes = points.map((point, index) => boundaryPrediction(point.position, parameters) !== point.classId ? index : -1).filter(index => index >= 0);
    return { mistakes, correct: points.length - mistakes.length, accuracy: points.length === 0 ? 0 : (points.length - mistakes.length) / points.length };
}
/** Intersect the plane n·x = offset with the displayed cube, preserving exact feature coordinates. */
export function boundaryPlanePolygon(normal: BoundaryVector, offset: number, extent = 3): BoundaryVector[] {
    if (normal.some(value => !Number.isFinite(value)) || Math.hypot(...normal) === 0 || !Number.isFinite(offset) || !Number.isFinite(extent) || extent <= 0) throw new RangeError('Use a finite nonzero plane normal and positive cube extent.');
    const corners: BoundaryVector[] = Array.from({ length: 8 }, (_, index) => [index & 1 ? extent : -extent, index & 2 ? extent : -extent, index & 4 ? extent : -extent]);
    const dot = (v: BoundaryVector) => v.reduce((sum, value, i) => sum + value * normal[i], 0);
    const points: BoundaryVector[] = [];
    corners.forEach((a, index) => [1, 2, 4].forEach(bit => {
        const other = index ^ bit; if (index >= other) return;
        const b = corners[other], fa = dot(a) - offset, fb = dot(b) - offset;
        if (Math.abs(fa - fb) < 1e-12 || fa * fb > 0) return;
        const t = fa / (fa - fb), point = a.map((value, axis) => value + t * (b[axis] - value)) as BoundaryVector;
        if (!points.some(previous => Math.hypot(...previous.map((value, axis) => value - point[axis])) < 1e-9)) points.push(point);
    }));
    if (points.length < 3) return points;
    const center = points.reduce((sum, point) => sum.map((value, axis) => value + point[axis] / points.length) as BoundaryVector, [0, 0, 0]);
    const first = points[0].map((value, axis) => value - center[axis]) as BoundaryVector;
    const second: BoundaryVector = [normal[1] * first[2] - normal[2] * first[1], normal[2] * first[0] - normal[0] * first[2], normal[0] * first[1] - normal[1] * first[0]];
    const angle = (point: BoundaryVector) => Math.atan2(point.reduce((sum, value, axis) => sum + (value - center[axis]) * second[axis], 0), point.reduce((sum, value, axis) => sum + (value - center[axis]) * first[axis], 0));
    return points.sort((a, b) => angle(a) - angle(b));
}
