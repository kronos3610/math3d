import { add3, layerNorm, routeExperts, transformerBlock, type Vector3 } from './ml-attention';
import { runStateSpace } from './ml-state-space';

export type HybridBlock = 'attention' | 'mamba2' | 'experts';
export function runHybrid(inputs: readonly Vector3[], blocks: readonly HybridBlock[]) {
    let values = inputs.map(input => [...input] as Vector3);
    const layers = [values];
    let cacheElements = 0;
    const cacheByLayer = [0];
    blocks.forEach(block => {
        if (block === 'attention') {
            values = transformerBlock(values, { heads: 2, mask: 'causal', position: 'rope' }).output;
            cacheElements += inputs.length * 2 * 3 * 2;
        } else if (block === 'mamba2') {
            const mixed = runStateSpace(values.map(layerNorm), { variant: 'mamba2', decay: 0.5, selection: 0.7 }).outputs;
            values = values.map((value, time) => add3(value, mixed[time])); cacheElements += 9;
        } else {
            const mixed = routeExperts(values.map(layerNorm), 2, 2).outputs;
            values = values.map((value, time) => add3(value, mixed[time]));
        }
        layers.push(values);
        cacheByLayer.push(cacheElements);
    });
    return { layers, output: values, cacheElements, cacheByLayer };
}
