/** Shared numerical tools for reproducible learning experiments on x ∈ [-1, 1]. */
export interface Sample {
    x: number;
    y: number;
}

export function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
}

export function sampleNormal(random: () => number): number {
    const u = Math.max(random(), Number.MIN_VALUE);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

function legendreBasis(x: number, degree: number): number[] {
    const values = [1];
    if (degree > 0) values.push(x);
    for (let k = 2; k <= degree; k++) {
        values.push(((2 * k - 1) * x * values[k - 1] - (k - 1) * values[k - 2]) / k);
    }
    return values;
}

export function evaluatePolynomial(coefficients: readonly number[], x: number): number {
    if (coefficients.length === 0) return 0;
    const basis = legendreBasis(x, coefficients.length - 1);
    return coefficients.reduce((sum, coefficient, index) => sum + coefficient * basis[index], 0);
}

/**
 * Solve mean squared error + ridge * sum(non-intercept coefficient²).
 * The Legendre basis and twice-orthogonalized QR avoid squaring the condition
 * number through normal equations. Ridge defaults to a small stabilizing value.
 */
export function fitPolynomial(samples: readonly Sample[], degree: number, ridge = 1e-6): number[] {
    if (!Number.isInteger(degree) || degree < 0 || degree > 12) {
        throw new RangeError('Polynomial degree must be an integer between 0 and 12.');
    }
    if (samples.length === 0 || !Number.isFinite(ridge) || ridge < 0) {
        throw new RangeError('Supply samples and a finite, nonnegative ridge penalty.');
    }
    if (samples.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1)) {
        throw new RangeError('Samples must be finite with x in [-1, 1].');
    }
    const width = degree + 1;
    if (ridge === 0 && samples.length < width) {
        throw new RangeError('Unregularized fitting requires at least degree + 1 samples.');
    }
    const rows = samples.length + (ridge > 0 ? degree : 0);
    const columns = Array.from({ length: width }, () => new Float64Array(rows));
    const target = new Float64Array(rows);
    samples.forEach(({ x, y }, i) => {
        const values = legendreBasis(x, degree);
        for (let j = 0; j < width; j++) columns[j][i] = values[j];
        target[i] = y;
    });
    if (ridge > 0) {
        const penalty = Math.sqrt(samples.length * ridge);
        for (let j = 1; j < width; j++) columns[j][samples.length + j - 1] = penalty;
    }
    const upper = Array.from({ length: width }, () => new Float64Array(width));
    const projected = new Float64Array(width);
    for (let j = 0; j < width; j++) {
        const column = columns[j];
        // Reorthogonalization also keeps narrow/sparse training sets stable.
        for (let pass = 0; pass < 2; pass++) {
            for (let k = 0; k < j; k++) {
                const previous = columns[k];
                let dot = 0;
                for (let i = 0; i < rows; i++) dot += previous[i] * column[i];
                upper[k][j] += dot;
                for (let i = 0; i < rows; i++) column[i] -= dot * previous[i];
            }
        }
        let normSquared = 0;
        for (let i = 0; i < rows; i++) normSquared += column[i] * column[i];
        const norm = Math.sqrt(normSquared);
        if (norm < 1e-12) throw new RangeError('The design is rank deficient; use a positive ridge penalty.');
        upper[j][j] = norm;
        for (let i = 0; i < rows; i++) {
            column[i] /= norm;
            projected[j] += column[i] * target[i];
        }
    }
    const coefficients = new Array<number>(width).fill(0);
    for (let j = width - 1; j >= 0; j--) {
        let value = projected[j];
        for (let k = j + 1; k < width; k++) value -= upper[j][k] * coefficients[k];
        coefficients[j] = value / upper[j][j];
    }
    return coefficients;
}
