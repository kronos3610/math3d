import { describe, expect, it } from 'vitest';
import { cachedDecode, cachedDecodeTrace, DEMO_EMBEDDINGS, dot, imagePatches, kvElements, layerNorm, linearAttention, rotatePairs, routeExperts, runAttention, softmax, tiledAttention, tiledAttentionTrace, transformerBlock, type KVLayout, type PositionEncoding, type Vector3 } from './ml-attention';

function near(actual: readonly (readonly number[])[], expected: readonly (readonly number[])[]) {
    actual.forEach((row,i) => row.forEach((value,j) => expect(value).toBeCloseTo(expected[i][j],11)));
}
describe('small attention computations', () => {
    it('normalizes large logits stably and handles an empty permitted set', () => {
        const result = softmax([1000,1001,-Infinity]);
        expect(result[0]).toBeCloseTo(1 / (1 + Math.E),12); expect(result[1]).toBeCloseTo(Math.E / (1 + Math.E),12); expect(result[2]).toBe(0);
        expect(softmax([-Infinity,-Infinity])).toEqual([0,0]);
    });
    it('uses exact masked dot products and weighted value coordinates', () => {
        const trace = runAttention(DEMO_EMBEDDINGS,{heads:2,mask:'causal'});
        trace.heads.forEach(head => head.weights.forEach((row,time) => {
            expect(row.reduce((a,b) => a+b,0)).toBeCloseTo(1,12);
            row.forEach((value,key) => { if (key > time) expect(value).toBe(0); else expect(head.scores[time][key]).toBeCloseTo(dot(head.queries[time],head.keys[key]) / Math.sqrt(3),12); });
            for (let axis = 0; axis < 3; axis++) expect(head.outputs[time][axis]).toBeCloseTo(row.reduce((sum,w,key) => sum + w * head.values[key][axis],0),12);
        }));
    });
    it('has equal permitted weights for zero queries and cannot read future vectors', () => {
        const uniform = runAttention(DEMO_EMBEDDINGS,{queryScale:0,mask:'causal'}).heads[0];
        expect(uniform.weights[2]).toEqual([1/3,1/3,1/3,0,0,0]);
        const modified = DEMO_EMBEDDINGS.map((value,time) => time === 5 ? [100,100,100] as Vector3 : value);
        near(runAttention(DEMO_EMBEDDINGS,{mask:'causal'}).outputs.slice(0,5),runAttention(modified,{mask:'causal'}).outputs.slice(0,5));
    });
    it('is permutation-equivariant without positions and RoPE is invariant to a common position shift', () => {
        near(runAttention([...DEMO_EMBEDDINGS].reverse()).outputs.reverse(),runAttention(DEMO_EMBEDDINGS).outputs);
        near(runAttention(DEMO_EMBEDDINGS,{position:'rope',offset:0}).heads[0].scores,runAttention(DEMO_EMBEDDINGS,{position:'rope',offset:17}).heads[0].scores);
        const value = [1,2,3]; expect(dot(rotatePairs(value,1.3),rotatePairs(value,1.3))).toBeCloseTo(14,12);
    });
    it('shares actual K/V projections according to the head layout', () => {
        const gqa = runAttention(DEMO_EMBEDDINGS,{heads:4,kvLayout:'gqa'});
        expect(gqa.heads[0].keys).toEqual(gqa.heads[1].keys); expect(gqa.heads[0].keys).not.toEqual(gqa.heads[2].keys);
        const mqa = runAttention(DEMO_EMBEDDINGS,{heads:4,kvLayout:'mqa'});
        mqa.heads.forEach(head => expect(head.values).toEqual(mqa.heads[0].values));
        expect(kvElements(6,4,'mha')).toBe(144); expect(kvElements(6,4,'gqa')).toBe(72); expect(kvElements(6,4,'mqa')).toBe(36); expect(kvElements(6,4,'mla')).toBe(24);
        for (const layout of ['mha','gqa','mqa','mla'] as KVLayout[]) {
            const retained = cachedDecodeTrace(DEMO_EMBEDDINGS,{heads:4,kvLayout:layout});
            expect(retained.retainedElements).toBe(kvElements(6,4,layout));
            if (layout === 'mla') { expect(retained.groups).toHaveLength(0); expect(retained.latents).toHaveLength(6); }
        }
    });
    it('cached decoding agrees with independently recomputed prefixes for all layouts and positions', () => {
        for (const layout of ['mha','gqa','mqa','mla'] as KVLayout[]) for (const position of ['none','sinusoidal','rope'] as PositionEncoding[]) {
            const cached = cachedDecode(DEMO_EMBEDDINGS,{heads:4,kvLayout:layout,position,offset:3});
            const expected = DEMO_EMBEDDINGS.map((_,time) => runAttention(DEMO_EMBEDDINGS.slice(0,time + 1),{heads:4,kvLayout:layout,position,offset:3,mask:'causal'}).outputs[time]);
            near(cached,expected);
        }
    });
    it('linear recurrence agrees with explicit positive-kernel mixtures', () => {
        const head = runAttention(DEMO_EMBEDDINGS).heads[0]; const trace = linearAttention(head);
        trace.outputs.forEach((output,time) => {
            expect(trace.weights[time].reduce((a,b) => a+b,0)).toBeCloseTo(1,12);
            output.forEach((value,axis) => expect(value).toBeCloseTo(trace.weights[time].reduce((sum,w,key) => sum + w * head.values[key][axis],0),12));
        });
        expect(trace.weights[4]).not.toEqual(head.weights[4]);
    });
    it('tiled online softmax agrees for every tile size, masked and extreme logits', () => {
        const scores = [1000,-Infinity,1002,995]; const values: Vector3[] = [[1,2,3],[99,99,99],[-1,0,2],[0.5,-1,1]];
        const weights = softmax(scores); const expected = [0,1,2].map(axis => weights.reduce((sum,w,i) => sum + w * values[i][axis],0));
        for (let tile = 1; tile <= 5; tile++) near([tiledAttention(scores,values,tile)],[expected]);
        expect(tiledAttention([-Infinity,-Infinity],values,1)).toEqual([0,0,0]);
        tiledAttentionTrace(scores,values,2).forEach(frame => {
            const prefix = softmax(scores.slice(0,frame.processed));
            near([frame.output],[[0,1,2].map(axis => prefix.reduce((sum,w,i) => sum + w * values[i][axis],0))]);
            expect(frame.maximum).toBe(Math.max(...scores.slice(0,frame.processed)));
        });
    });
    it('normalization and residual stages expose their actual operations', () => {
        const normalized = layerNorm([1,2,3]); expect(normalized.reduce((a,b) => a+b,0)).toBeCloseTo(0,12);
        expect(normalized.reduce((sum,v) => sum + v*v,0) / 3).toBeCloseTo(1,4);
        const block = transformerBlock(DEMO_EMBEDDINGS);
        block.residual.forEach((vector,time) => vector.forEach((value,axis) => expect(value).toBeCloseTo(block.input[time][axis] + block.attention[time][axis],12)));
        expect(transformerBlock(DEMO_EMBEDDINGS,{},'pre').output).not.toEqual(transformerBlock(DEMO_EMBEDDINGS,{},'post').output);
    });
    it('capacity drops real expert routes and accepted top-k mixtures use normalized weights', () => {
        const repeated = Array.from({length:6},() => [1,0,0] as Vector3);
        const limited = routeExperts(repeated,1,0.25); expect(limited.capacity).toBe(1); expect(limited.dropped).toBe(5);
        const full = routeExperts(repeated,2,3); expect(full.dropped).toBe(0);
        full.routes.forEach(row => expect(row.reduce((sum,route) => sum + route.weight,0)).toBeCloseTo(1,12));
    });
    it('extracts exact patch features from a known striped image', () => {
        const fine = imagePatches(2,'stripes'); expect(fine.patches).toHaveLength(16); expect(fine.patches[0].vector).toEqual([1,0,0]);
        const coarse = imagePatches(4,'stripes'); expect(coarse.patches).toHaveLength(4);
        expect(coarse.patches[0].vector[0]).toBeCloseTo(0.55,12); expect(coarse.patches[0].vector[1]).toBeCloseTo(-0.45,12);
    });
});
