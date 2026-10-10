import { expect, test } from 'vitest';
import { spatialTransform, type LabVector } from './spatial-model';

test('isotropic display preserves angles and relative vector lengths', () => {
    const a: LabVector = [1,2,3]; const b: LabVector = [-2,1,4];
    const transform = spatialTransform({description:'geometry',points:[{position:a},{position:b}]});
    const origin = transform.map([0,0,0]);
    const ma = transform.map(a).map((value,i) => value - origin[i]); const mb = transform.map(b).map((value,i) => value - origin[i]);
    const dot = (x: readonly number[],y: readonly number[]) => x.reduce((sum,value,i) => sum + value * y[i],0);
    expect(dot(ma,mb) / Math.sqrt(dot(ma,ma) * dot(mb,mb))).toBeCloseTo(dot(a,b) / Math.sqrt(dot(a,a) * dot(b,b)),12);
    expect(Math.sqrt(dot(ma,ma) / dot(mb,mb))).toBeCloseTo(Math.sqrt(dot(a,a) / dot(b,b)),12);
});
test('bounds include box faces, surface values, arrows, and the true origin', () => {
    const transform = spatialTransform({description:'bounds',boxes:[{position:[2,3,4],size:[2,4,6]}],vectors:[{from:[-4,0,0],to:[2,-5,1]}],surfaces:[{vertices:[[0,9,0],[1,9,0],[0,10,1],[1,10,1]],columns:2}]});
    expect(transform.minimum).toEqual([-4,-5,0]); expect(transform.maximum).toEqual([3,10,7]);
    expect(transform.scale[0]).toBe(transform.scale[1]); expect(transform.scale[1]).toBe(transform.scale[2]);
});
test('empty/constant geometry stays finite and explicit independent axis scaling is available', () => {
    const empty = spatialTransform({description:'empty'}); expect(empty.map([0,0,0])).toEqual([0,0,0]);
    const independent = spatialTransform({description:'scaled',equalScale:false,points:[{position:[1,100,3]}]});
    expect(independent.scale[0]).not.toBe(independent.scale[1]);
    independent.map([1,100,3]).forEach(value => expect(value).toBeCloseTo(3.5,12));
});
test('complex-plane scaling preserves phase angles while the time axis scales independently', () => {
    const transform = spatialTransform({description:'complex state',equalScale:false,equalAxes:[0,1],points:[{position:[2,1,100]}]});
    expect(transform.scale[0]).toBe(transform.scale[1]);
    expect(transform.scale[2]).not.toBe(transform.scale[0]);
    const origin = transform.map([0,0,0]); const point = transform.map([2,1,100]);
    expect(Math.atan2(point[1] - origin[1],point[0] - origin[0])).toBeCloseTo(Math.atan2(1,2),12);
});
test('small nonzero gate contributions fill the view while preserving their geometry', () => {
    const transform = spatialTransform({description:'gated state',vectors:[{from:[0,0,0],to:[0.04,-0.023,0.022]}]});
    const origin = transform.map([0,0,0]); const tip = transform.map([0.04,-0.023,0.022]);
    expect(tip[0] - origin[0]).toBeCloseTo(7,12);
    expect((tip[1] - origin[1]) / (tip[0] - origin[0])).toBeCloseTo(-0.023 / 0.04,12);
});
