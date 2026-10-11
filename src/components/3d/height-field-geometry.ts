import { BufferAttribute, BufferGeometry } from 'three';
import type { LabVector } from './spatial-model';

export interface HeightFieldGrid { vertices: LabVector[]; columns: number; }

/** Input (x,y) lies on the world X/Z floor; function values use world Y. */
export function sampleHeightField(f: (x: number, y: number) => number, extent: number, resolution = 48): HeightFieldGrid {
    if (!(extent > 0) || !Number.isFinite(extent) || !Number.isInteger(resolution) || resolution < 1) throw new Error('Use a positive extent and an integer resolution.');
    const vertices: LabVector[] = [];
    for (let row = 0; row <= resolution; row++) for (let column = 0; column <= resolution; column++) {
        const x = -extent / 2 + column * extent / resolution;
        const y = -extent / 2 + row * extent / resolution;
        const height = f(x, y);
        if (!Number.isFinite(height)) throw new Error('Height fields require finite function values.');
        vertices.push([x, height, y]);
    }
    return { vertices, columns: resolution + 1 };
}

export function heightFieldGeometry({ vertices, columns }: HeightFieldGrid): BufferGeometry {
    const indices: number[] = [];
    const rows = vertices.length / columns;
    for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns - 1; column++) {
        const a = row * columns + column; const b = a + 1; const c = a + columns; const d = c + 1;
        indices.push(a, c, b, b, c, d);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices.flat()), 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}

