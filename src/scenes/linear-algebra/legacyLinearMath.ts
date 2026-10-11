export type Vector3Tuple = [number, number, number];
export type Matrix3Tuple = [number, number, number, number, number, number, number, number, number];

export function multiplyMatrixVector(matrix: Matrix3Tuple, vector: Vector3Tuple): Vector3Tuple {
    return [0, 1, 2].map(row => matrix[3 * row] * vector[0] + matrix[3 * row + 1] * vector[1] + matrix[3 * row + 2] * vector[2]) as Vector3Tuple;
}

export function matrixDeterminant(matrix: Matrix3Tuple): number {
    return matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) - matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) + matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6]);
}

export function transformationMatrix(scale: Vector3Tuple, angle: number, shear: number): Matrix3Tuple {
    const c = Math.cos(angle); const s = Math.sin(angle);
    return [c * scale[0], (c * shear - s) * scale[1], 0, s * scale[0], (s * shear + c) * scale[1], 0, 0, 0, scale[2]];
}

export function assessEigenvector(vector: Vector3Tuple, transformed: Vector3Tuple): { isEigen: boolean; lambda: number | null; residual: number } {
    const length = Math.hypot(...vector);
    if (length === 0 || !Number.isFinite(length) || transformed.some(value => !Number.isFinite(value))) return { isEigen: false, lambda: null, residual: Infinity };
    const lambda = vector.reduce((sum, value, index) => sum + value / length * transformed[index], 0) / length;
    const error = Math.hypot(...transformed.map((value, index) => value - lambda * vector[index]));
    const scale = Math.max(Math.hypot(...transformed), Math.abs(lambda) * length);
    const residual = scale === 0 ? 0 : error / scale;
    return { isEigen: residual <= 1e-6, lambda, residual };
}

export const SUBSPACE_MATRIX: Matrix3Tuple = [1, 2, 0, 0, 1, 1, 1, 3, 1];
export const SUBSPACE_EXAMPLE = {
    x: [3, 3, 3] as Vector3Tuple,
    x_row: [1, 4, 2] as Vector3Tuple,
    x_null: [2, -1, 1] as Vector3Tuple,
    b: multiplyMatrixVector(SUBSPACE_MATRIX, [3, 3, 3]),
    rowNormal: [2, -1, 1] as Vector3Tuple,
    colNormal: [-1, -1, 1] as Vector3Tuple,
    c1: [1, 0, 1] as Vector3Tuple,
    c2: [2, 1, 3] as Vector3Tuple,
};

/** Deterministic equal-area direction samples, independent of the renderer. */
export function fibonacciSphere(count = 300): Vector3Tuple[] {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, index) => {
        const y = 1 - 2 * (index + 0.5) / count;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        const angle = goldenAngle * index;
        return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    });
}

/** Absolute cosine keeps negative eigenvalues bright; a zero image is λ = 0. */
export function eigenAlignment(matrix: Matrix3Tuple, direction: Vector3Tuple): number {
    const image = multiplyMatrixVector(matrix, direction);
    const assessment = assessEigenvector(direction, image);
    if (assessment.isEigen) return 1;
    const denominator = Math.hypot(...direction) * Math.hypot(...image);
    if (denominator === 0 || !Number.isFinite(denominator)) return 0;
    return Math.min(1, Math.abs(direction.reduce((sum, value, axis) => sum + value * image[axis], 0)) / denominator);
}
