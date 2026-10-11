export interface BoxData {
    position: [number, number, number];
    scale: [number, number, number];
}

/**
 * Calculates the Riemann sum boxes for a given function and domain.
 *
 * @param start - The start of the domain (x-axis)
 * @param end - The end of the domain (x-axis)
 * @param nPartitions - The number of boxes to create
 * @param func - The mathematical function f(x)
 * @returns An array of box data containing position and scale
 */
export const calculateRiemannBoxes = (
    start: number,
    end: number,
    nPartitions: number,
    func: (x: number) => number
): BoxData[] => {
    if (nPartitions <= 0) {
        return [];
    }

    const dx = (end - start) / nPartitions;
    const boxData: BoxData[] = [];

    for (let i = 0; i < nPartitions; i++) {
        const x = start + i * dx + dx / 2;
        const h = func(x);
        boxData.push({
            position: [x, h / 2, 0],
            scale: [dx * 0.9, h, 0.5],
        });
    }

    return boxData;
};

export type IntegrationMode = 'riemann' | 'lebesgue';
export type IntegrationFunction = 'smooth' | 'spiky';
export type VolumeFunction = (x: number, y: number) => number;
export interface VolumeCell { position: [number, number, number]; scale: [number, number, number]; }
export const integrationFields: Record<IntegrationFunction, VolumeFunction> = {
    smooth: (x, y) => (Math.sin(x * 0.4) * Math.cos(y * 0.4) + Math.cos(Math.hypot(x, y) * 0.5) * 0.5 + 1.5) * 2,
    spiky: (x, y) => 0.5 + [[3, 3], [-4, 2], [0, -5], [5, -2]].reduce((sum, [a, b]) => sum + 8 * Math.exp(-5 * ((x - a) ** 2 + (y - b) ** 2)), 0),
};
export const INTEGRATION_EXTENT = 20;
export const LAYER_HEIGHT = 9;
export const FLOOR_GRID = 40;

/** Use the same threshold comparisons for the 3D cells, totals and native view. */
export function admittedLayers(height: number, resolution: number): number {
    const heightStep = LAYER_HEIGHT / resolution;
    let layers = 0;
    for (let level = 1; level <= resolution; level++) if (height >= level * heightStep) layers++;
    return layers;
}

export function midpointVolume(f: VolumeFunction, divisions: number): number {
    if (!Number.isInteger(divisions) || divisions < 1) throw new Error('Use a positive integer grid count.');
    const width = INTEGRATION_EXTENT / divisions;
    let total = 0;
    for (let i = 0; i < divisions; i++) for (let j = 0; j < divisions; j++) total += f(-10 + (i + 0.5) * width, -10 + (j + 0.5) * width) * width ** 2;
    return total;
}

/** Draw gaps separate cells, while numerical sums use their full partition widths. */
export function partitionVolumeCells(mode: IntegrationMode, f: VolumeFunction, resolution: number): VolumeCell[] {
    if (!Number.isInteger(resolution) || resolution < 1) throw new Error('Use a positive integer refinement count.');
    const cells: VolumeCell[] = [];
    if (mode === 'riemann') {
        const width = INTEGRATION_EXTENT / resolution;
        for (let i = 0; i < resolution; i++) for (let j = 0; j < resolution; j++) {
            const x = -10 + (i + 0.5) * width; const y = -10 + (j + 0.5) * width;
            const height = f(x, y);
            cells.push({ position: [x, height / 2, y], scale: [width * 0.99, height, width * 0.99] });
        }
    } else {
        const heightStep = LAYER_HEIGHT / resolution; const width = INTEGRATION_EXTENT / FLOOR_GRID;
        const heights = Array.from({ length: FLOOR_GRID * FLOOR_GRID }, (_, index) => f(-10 + Math.floor(index / FLOOR_GRID) * width, -10 + index % FLOOR_GRID * width));
        for (let layer = 0; layer < resolution; layer++) for (let i = 0; i < FLOOR_GRID; i++) for (let j = 0; j < FLOOR_GRID; j++) {
            if (heights[i * FLOOR_GRID + j] >= (layer + 1) * heightStep) {
                cells.push({ position: [-10 + (i + 0.5) * width, (layer + 0.5) * heightStep, -10 + (j + 0.5) * width], scale: [width, heightStep * 0.99, width] });
            }
        }
    }
    return cells;
}

export function integrationTotals(f: VolumeFunction, resolution: number, reference = midpointVolume(f, 200)) {
    if (!Number.isInteger(resolution) || resolution < 1) throw new Error('Use a positive integer refinement count.');
    const heightStep = LAYER_HEIGHT / resolution; const width = INTEGRATION_EXTENT / FLOOR_GRID;
    let lebesgue = 0; let sampledFloor = 0;
    for (let i = 0; i < FLOOR_GRID; i++) for (let j = 0; j < FLOOR_GRID; j++) {
        const height = f(-10 + i * width, -10 + j * width);
        sampledFloor += height * width ** 2;
        // Counting exact admitted levels matches the displayed layer cells.
        lebesgue += admittedLayers(height, resolution) * heightStep * width ** 2;
    }
    const riemann = midpointVolume(f, resolution);
    return { riemann, lebesgue, reference, sampledFloor, riemannError: riemann - reference, lebesgueError: lebesgue - reference };
}
