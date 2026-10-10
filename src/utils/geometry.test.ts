import { test } from 'vitest';
import assert from 'node:assert';
import { generateEllipsePoints } from './geometry.ts';

test('generateEllipsePoints basic functionality', () => {
    // Basic test with original parameters
    const points = generateEllipsePoints(2, 1.2, 4);
    assert.strictEqual(points.length, 5, 'Should generate segments + 1 points');

    // Check first and last point match (closed loop)
    const first = points[0];
    const last = points[points.length - 1];

    // Using approx checks for floats
    assert.ok(Math.abs(first[0] - last[0]) < 1e-10, 'First and last X should match');
    assert.ok(Math.abs(first[1] - last[1]) < 1e-10, 'First and last Y should match');
    assert.strictEqual(first[2], 0, 'Z should be 0');

    // Check points lie on the ellipse: (x/a)^2 + (y/b)^2 = 1
    for (const [x, y, z] of points) {
        const val = (x / 2) ** 2 + (y / 1.2) ** 2;
        assert.ok(Math.abs(val - 1) < 1e-10, `Point (${x}, ${y}) should be on ellipse`);
        assert.strictEqual(z, 0, 'Z coordinate should be 0');
    }
});

test('generateEllipsePoints circle case', () => {
    const points = generateEllipsePoints(1, 1, 8); // Circle with radius 1
    assert.strictEqual(points.length, 9);

    for (const [x, y, z] of points) {
        const dist = Math.sqrt(x*x + y*y);
        assert.ok(Math.abs(dist - 1) < 1e-10, `Point (${x}, ${y}) should be on unit circle`);
        assert.strictEqual(z, 0);
    }
});

test('generateEllipsePoints edge cases', () => {
    // 0 segments -> just start point
    const points0 = generateEllipsePoints(2, 1.2, 0);
    assert.strictEqual(points0.length, 1);
    // Should return just [radiusX, 0, 0] because i=0 to 0
    assert.strictEqual(points0[0][0], 2);
    assert.strictEqual(points0[0][1], 0);

    // 0 radius -> all points at origin
    const pointsZeroRad = generateEllipsePoints(0, 0, 4);
    assert.strictEqual(pointsZeroRad.length, 5);
    for (const [x, y, z] of pointsZeroRad) {
        // Use === 0 to handle -0 correctly
        assert.ok(x === 0, `x should be 0 (got ${x})`);
        assert.ok(y === 0, `y should be 0 (got ${y})`);
        assert.ok(z === 0, `z should be 0 (got ${z})`);
    }
});
