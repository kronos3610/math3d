import { describe, expect, it } from 'vitest';
import { makeStream, runStateSpace, stateSpaceDual } from './ml-state-space';
import { runHybrid } from './ml-hybrid';
import { DEMO_EMBEDDINGS, type Vector3 } from './ml-attention';

describe('state-space teaching cores', () => {
    it('matches a known fixed-system impulse response', () => {
        const trace = runStateSpace([[1,0,0],[0,0,0],[0,0,0]],{variant:'ssm',decay:0.5,stepSize:0.5});
        expect(trace.states[0][0]).toEqual([0.5,0.25,-0.125]);
        trace.outputs.forEach((value,time) => expect(value[0]).toBeCloseTo(0.2 * Math.exp(-0.25 * time),12));
    });
    it('matrix and recurrence forms agree for fixed, diagonal, and scalar selective dynamics', () => {
        const inputs = makeStream('cue',10,0.35);
        for (const variant of ['ssm','mamba','mamba2'] as const) {
            const trace = runStateSpace(inputs,{variant,decay:0.3,selection:1.7});
            for (let channel = 0; channel < 3; channel++) {
                const dual = stateSpaceDual(trace,channel);
                dual.outputs.forEach((value,time) => expect(value).toBeCloseTo(trace.outputs[time][channel],12));
                dual.matrix.forEach((row,time) => row.forEach((value,source) => { if (source > time) expect(value).toBe(0); }));
            }
        }
    });
    it('distinguishes diagonal Mamba-1 dynamics from scalar Mamba-2 dynamics', () => {
        const inputs = makeStream('alternating',6,0);
        const one = runStateSpace(inputs,{variant:'mamba'}); const two = runStateSpace(inputs,{variant:'mamba2'});
        expect(new Set(one.transitions[0][0]).size).toBe(3); expect(new Set(two.transitions[0][0]).size).toBe(1);
    });
    it('Mamba-3 at λ=1 with no rotation reproduces the real Mamba-2 core', () => {
        const inputs = makeStream('cue',8,0.2);
        const two = runStateSpace(inputs,{variant:'mamba2'}); const three = runStateSpace(inputs,{variant:'mamba3',lambda:1,angle:0});
        expect(three.states).toEqual(two.states); expect(three.outputs).toEqual(two.outputs);
        three.imaginary.flat(2).forEach(value => expect(value).toBe(0));
    });
    it('computes the complex trapezoidal previous-forcing contribution independently', () => {
        const trace = runStateSpace([[1,0,0],[0,0,0]],{variant:'mamba3',lambda:0.5,angle:1,selection:0,stepSize:0.5,decay:0.4});
        const dt = trace.deltas[0][0]; const alpha = Math.exp(-0.4 * dt); const force = trace.write[0][0][0];
        const h0 = 0.5 * dt * force;
        expect(trace.states[1][0][0]).toBeCloseTo(alpha * Math.cos(dt) * h0 + 0.5 * dt * alpha * Math.cos(dt) * force,12);
        expect(trace.imaginary[1][0][0]).toBeCloseTo(alpha * Math.sin(dt) * h0 + 0.5 * dt * alpha * Math.sin(dt) * force,12);
    });
    it('fixed parameters remove input selection and MIMO keeps state size fixed', () => {
        const inputs = makeStream('alternating',6,0);
        const fixed = runStateSpace(inputs,{variant:'mamba2',selection:0}); expect(fixed.deltas[0]).toEqual(fixed.deltas[1]); expect(fixed.write[0]).toEqual(fixed.write[1]);
        const siso = runStateSpace(inputs,{variant:'mamba3',mimo:false}); const mimo = runStateSpace(inputs,{variant:'mamba3',mimo:true});
        expect(siso.stateElements).toBe(mimo.stateElements); expect(mimo.outputs).not.toEqual(siso.outputs);
    });
    it('future inputs cannot alter earlier outputs, including hybrid stacks', () => {
        const changed = DEMO_EMBEDDINGS.map((value,time) => time === 5 ? [9,-9,9] as Vector3 : value);
        expect(runStateSpace(changed,{variant:'mamba3'}).outputs.slice(0,5)).toEqual(runStateSpace(DEMO_EMBEDDINGS,{variant:'mamba3'}).outputs.slice(0,5));
        expect(runHybrid(changed,['attention','mamba2','experts']).output.slice(0,5)).toEqual(runHybrid(DEMO_EMBEDDINGS,['attention','mamba2','experts']).output.slice(0,5));
    });
});
