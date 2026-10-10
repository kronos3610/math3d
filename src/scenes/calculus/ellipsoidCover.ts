export const ELLIPSOID_AXES: readonly [number, number, number] = [1.6, 0.9, 1.2];
export interface CoverCell { position: [number, number, number]; size: number; }
export const ELLIPSOID_VOLUME = 4 * Math.PI * ELLIPSOID_AXES[0] * ELLIPSOID_AXES[1] * ELLIPSOID_AXES[2] / 3;

/** Keep exactly the grid cells whose closed boxes intersect the ellipsoid. */
export function ellipsoidGridCover(divisions: number): CoverCell[] {
    if (!Number.isInteger(divisions) || divisions < 1 || divisions > 64) throw new Error('Choose 1–64 grid divisions.');
    const size = 4 / divisions;
    const cells: CoverCell[] = [];
    for (let x = 0; x < divisions; x++) for (let y = 0; y < divisions; y++) for (let z = 0; z < divisions; z++) {
        const position = [x, y, z].map(index => -2 + (index + 0.5) * size) as [number, number, number];
        const minimum = position.reduce((sum, coordinate, axis) => sum + (Math.max(0, Math.abs(coordinate) - size / 2) / ELLIPSOID_AXES[axis]) ** 2, 0);
        if (minimum <= 1 + 1e-12) cells.push({ position, size });
    }
    return cells;
}
