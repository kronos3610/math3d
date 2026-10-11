import { multiplyMatrixVector, SUBSPACE_MATRIX, type Vector3Tuple } from './legacyLinearMath';

const NULL_DIRECTION: Vector3Tuple = [2, -1, 1];
/** Orthogonal projection onto N(A); the remaining vector lies in the row space. */
export function decomposeSubspaceInput(input: Vector3Tuple) {
    if (input.some(value => !Number.isFinite(value))) throw new RangeError('Input coordinates must be finite.');
    const coefficient = input.reduce((sum, value, axis) => sum + value * NULL_DIRECTION[axis], 0) / 6;
    const nullPart = NULL_DIRECTION.map(value => value * coefficient) as Vector3Tuple;
    const rowPart = input.map((value, axis) => value - nullPart[axis]) as Vector3Tuple;
    const dot = rowPart.reduce((sum, value, axis) => sum + value * nullPart[axis], 0);
    const reconstructionError = Math.hypot(...input.map((value, axis) => value - rowPart[axis] - nullPart[axis]));
    return { rowPart, nullPart, dot, reconstructionError, output: multiplyMatrixVector(SUBSPACE_MATRIX, input), nullOutput: multiplyMatrixVector(SUBSPACE_MATRIX, nullPart) };
}
