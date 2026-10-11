import { VIZ } from '../../data/palette';
import { useMemo, useState } from 'react';
import { VisualLab, LabPlayback, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { SpatialScene, type SpatialPoint, type SpatialPath, type SpatialVector, type SpatialBox, type LabVector } from '../../components/3d/SpatialScene';
import { SceneExplanation, ExplanationSection } from '../../components/layout/SceneExplanation';
import { cachedDecodeTrace, combineHeadOutputs, DEMO_EMBEDDINGS, DEMO_TOKENS, imagePatches, layerNorm, linearAttention, magnitude, routeExperts, runAttention, tiledAttentionTrace, transformerBlock, type AttentionMask, type HeadTrace, type KVLayout, type PositionEncoding, type Vector3 } from '../../utils/ml-attention';
import { runHybrid, type HybridBlock } from '../../utils/ml-hybrid';

export type AttentionLabMode = 'attention' | 'block' | 'architectures' | 'position' | 'cache' | 'efficient' | 'experts' | 'vision' | 'flash' | 'memory' | 'hybrid' | 'embeddings' | 'softmax' | 'normalization';
const TITLES: Record<AttentionLabMode, string> = {
    attention: 'Attention: queries, keys & values', block: 'Inside a transformer block', architectures: 'Transformer architecture families',
    position: 'Position encoding & attention masks', cache: 'Decoding, KV cache & grouped heads', efficient: 'Sparse & linear attention',
    experts: 'Mixture of experts', vision: 'Vision transformers: patches to tokens', flash: 'Tiled exact attention', memory: 'Transformer segment memory',
    hybrid: 'Hybrid attention & state-space models', embeddings: 'Embeddings & representation space', softmax: 'Softmax & weighted mixtures', normalization: 'Normalization & residual paths',
};
const PALETTE = [VIZ.focus,VIZ.data,VIZ.truth,VIZ.error,VIZ.output,'#fb923c'];
const vec3 = (values: readonly number[]): LabVector => [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
const f = (value: number) => value.toFixed(3);

function WeightTable({ head, labels, selected }: { head: HeadTrace; labels: readonly string[]; selected: number }) {
    return <div className="visual-lab-matrix"><table><caption>Computed attention weights</caption>
        <thead><tr><th scope="col">Q → K</th>{head.keys.map((_, index) => <th key={index} scope="col">{labels[index] ?? `m${index}`}</th>)}</tr></thead>
        <tbody>{head.weights.map((row, i) => <tr key={i}><th scope="row">{i + 1}</th>{row.map((weight, j) => <td key={j} title={`Query ${i + 1}, key ${j + 1}: ${weight.toFixed(6)}`}
            style={{ background: `rgba(45,212,191,${weight * 0.8})`, color: i === selected ? '#fff' : 'var(--text-secondary)' }}>{weight.toFixed(2)}</td>)}</tr>)}</tbody>
    </table></div>;
}

export default function AttentionLab({ mode = 'attention' }: { mode?: AttentionLabMode }) {
    const [tokens, setTokens] = useState(() => DEMO_TOKENS.map((label, index) => ({ label, value: [...DEMO_EMBEDDINGS[index]] as Vector3 })));
    const [query, setQuery] = useState(2); const [headIndex, setHeadIndex] = useState(0); const [headCount, setHeadCount] = useState(2);
    const [queryScale, setQueryScale] = useState(1); const [mask, setMask] = useState<AttentionMask>(mode === 'position' ? 'bidirectional' : 'causal'); const [position, setPosition] = useState<PositionEncoding>('none');
    const [offset, setOffset] = useState(0); const [windowSize, setWindowSize] = useState(1); const [layout, setLayout] = useState<KVLayout>('mha');
    const [view, setView] = useState('keys'); const [stage, setStage] = useState(0); const [matrix, setMatrix] = useState(false); const [editing, setEditing] = useState(false);
    const [architecture, setArchitecture] = useState('decoder'); const [normalization, setNormalization] = useState<'pre'|'post'>('pre');
    const [activation, setActivation] = useState<'relu'|'gelu'|'swiglu'>('gelu'); const [efficient, setEfficient] = useState('dense');
    const [topK, setTopK] = useState(1); const [capacity, setCapacity] = useState(1); const [tileSize, setTileSize] = useState(2);
    const [patchSize, setPatchSize] = useState<2|4>(2); const [pattern, setPattern] = useState<'stripes'|'checker'|'diagonal'>('checker');
    const [memoryLength, setMemoryLength] = useState(3); const [hybrid, setHybrid] = useState('mixed');
    const inputs = useMemo(() => tokens.map(token => token.value), [tokens]);
    const patches = useMemo(() => imagePatches(patchSize, pattern), [patchSize, pattern]);
    const encoder = useMemo(() => transformerBlock(inputs, { heads: headCount, mask: 'bidirectional', position }).output, [inputs, headCount, position]);
    const decoder = useMemo(() => transformerBlock(inputs, { heads: headCount, mask: 'causal', position }).output, [inputs, headCount, position]);
    const memory = useMemo(() => transformerBlock(DEMO_EMBEDDINGS.slice(0, memoryLength), { heads: headCount, mask: 'causal', position: 'rope' }).output, [memoryLength, headCount]);
    const cachePosition = layout === 'mla' ? 'none' : position;
    const attention = useMemo(() => runAttention(mode === 'vision' ? patches.patches.map(patch => patch.vector)
        : mode === 'architectures' && architecture === 'encoder-decoder' ? decoder
            : (mode === 'block' || mode === 'normalization') && normalization === 'pre' ? inputs.map(layerNorm) : inputs, {
        heads: headCount, queryScale, seed: 3610,
        mask: mode === 'architectures' ? architecture === 'encoder' || architecture === 'encoder-decoder' ? 'bidirectional' : 'causal'
            : mode === 'efficient' ? efficient === 'sparse' ? 'local' : 'causal' : mode === 'vision' ? 'bidirectional' : mode === 'cache' || mode === 'memory' ? 'causal' : mask,
        position: mode === 'memory' ? 'rope' : mode === 'cache' ? cachePosition : position, offset: mode === 'memory' ? memoryLength : offset,
        maskOffset: mode === 'memory' ? memoryLength : 0,
        window: windowSize, kvLayout: mode === 'cache' ? layout : 'mha',
        keyInputs: mode === 'architectures' && architecture === 'encoder-decoder' ? encoder : mode === 'memory' ? [...memory, ...inputs] : undefined,
    }), [mode, patches, inputs, headCount, queryScale, architecture, efficient, mask, position, memoryLength, offset, windowSize, layout, encoder, memory, decoder, normalization, cachePosition]);
    const selectedHead = attention.heads[Math.min(headIndex, headCount - 1)];
    const selected = Math.min(mode === 'cache' ? stage : query, attention.outputs.length - 1);
    const block = useMemo(() => transformerBlock(inputs, { heads: headCount, mask, position, queryScale }, normalization, activation), [inputs, headCount, mask, position, queryScale, normalization, activation]);
    const linear = useMemo(() => linearAttention(selectedHead), [selectedHead]);
    const allLinear = useMemo(() => attention.heads.map(head => linearAttention(head)), [attention.heads]);
    const decodeCount = Math.min(stage,inputs.length - 1) + 1;
    const cache = useMemo(() => cachedDecodeTrace(inputs.slice(0,decodeCount), { heads: headCount, position:cachePosition, queryScale, kvLayout: layout, offset }), [inputs, decodeCount, headCount, cachePosition, queryScale, layout, offset]);
    const experts = useMemo(() => routeExperts(inputs, topK, capacity), [inputs, topK, capacity]);
    const hybridBlocks: HybridBlock[] = hybrid === 'attention' ? ['attention','attention','attention'] : hybrid === 'state' ? ['mamba2','mamba2','mamba2'] : ['attention','mamba2','experts'];
    const hybridTrace = useMemo(() => runHybrid(inputs, hybrid === 'attention' ? ['attention','attention','attention'] : hybrid === 'state' ? ['mamba2','mamba2','mamba2'] : ['attention','mamba2','experts']), [inputs, hybrid]);
    const tiles = useMemo(() => tiledAttentionTrace(selectedHead.scores[selected], selectedHead.values, tileSize),[selectedHead,selected,tileSize]);
    const tiled = tiles.at(-1)!.output;
    const weights = mode === 'efficient' && efficient === 'linear' ? linear.weights[selected] : selectedHead.weights[selected];
    const headOutput = mode === 'efficient' && efficient === 'linear' ? linear.outputs[selected] : selectedHead.outputs[selected];
    const combinedOutput = mode === 'efficient' && efficient === 'linear' ? combineHeadOutputs(allLinear.map(head => head.outputs[selected])) : attention.outputs[selected];
    const entropy = -weights.reduce((sum, weight) => weight > 0 ? sum + weight * Math.log(weight) : sum, 0);
    const cacheError = mode === 'cache' ? Math.max(...cache.outputs.flatMap((value, time) => value.map((v, axis) => Math.abs(v - attention.outputs[time][axis])))) : 0;
    const stages = mode === 'flash' ? Math.ceil(selectedHead.keys.length / tileSize) - 1 : mode === 'hybrid' ? 3 : mode === 'cache' ? inputs.length - 1 : 4;
    const safeStage = Math.min(stage, stages);
    const liveTile = tiles[Math.min(safeStage,tiles.length - 1)];
    const blockPhases = [block.input,block.attention,block.residual,block.normalized,block.output];
    const plottedOutput = mode === 'block' || mode === 'normalization' ? blockPhases[safeStage][selected]
        : mode === 'hybrid' ? hybridTrace.layers[safeStage][selected]
            : mode === 'embeddings' ? inputs[selected] : combinedOutput;
    const showsAttentionMatrix = !['experts','embeddings','hybrid'].includes(mode);
    const editVector = (axis: number, value: number) => setTokens(current => current.map(token => token.label === current[selected].label
        ? { ...token, value: token.value.map((v, i) => i === axis ? value : v) as Vector3 } : token));

    const plot = useMemo(() => {
        const points: SpatialPoint[] = []; const paths: SpatialPath[] = []; const vectors: SpatialVector[] = []; const boxes: SpatialBox[] = [];
        let axes: [string,string,string] = ['coordinate 1','coordinate 2','coordinate 3'];
        let description = 'Three-dimensional demonstration vectors and their computed attention relationships.';
        if (mode === 'experts') {
            axes = ['token index','selected mixture weight','expert index']; description = 'Tokens route to three numerical feed-forward experts. Height and line width use the renormalized top-k mixture weight, not the original router probability; red paths exceed capacity.';
            inputs.forEach((_, time) => {
                points.push({ position: [time,0,-1], color: PALETTE[time % 6], label: tokens[time].label });
                experts.routes[time].forEach(route => paths.push({ points: [[time,0,-1],[time,route.weight,route.expert]], color: route.accepted ? PALETTE[route.expert] : VIZ.error, width: 1 + 7 * route.weight, dashed: !route.accepted }));
            });
            for (let expert = 0; expert < 3; expert++) boxes.push({ position: [2.5,1.2,expert], size: [5.8,0.15,0.2], color: PALETTE[expert], label: `Expert ${expert + 1}: load ${experts.loads[expert]}/${experts.capacity}` });
        } else if (mode === 'vision') {
            axes = ['image column','pixel intensity','image row']; description = 'An eight-by-eight image becomes patch tokens. Patch vectors contain mean intensity and two directional contrasts; links show computed attention.';
            patches.pixels.forEach((row, r) => row.forEach((value, c) => boxes.push({ position: [c,value / 2,r], size: [0.85,Math.max(0.05,value),0.85], color: value > 0.5 ? VIZ.data : '#172c4a', opacity: 0.85 })));
            patches.patches.forEach((patch, index) => {
                const p: LabVector = [patch.column + patchSize / 2 - 0.5,1.5,patch.row + patchSize / 2 - 0.5];
                points.push({ position: p, color: index === selected ? VIZ.focus : VIZ.truth, radius: 0.1, label: index === selected ? `Patch ${index + 1}` : undefined });
                if (weights[index] > 0.02) paths.push({ points: [[patches.patches[selected].column + patchSize / 2 - 0.5,1.5,patches.patches[selected].row + patchSize / 2 - 0.5],p], color: VIZ.focus, width: weights[index] * 20 });
            });
        } else if (mode === 'block' || mode === 'normalization' || mode === 'hybrid') {
            const phases = mode === 'hybrid' ? hybridTrace.layers : [block.input,block.attention,block.residual,block.normalized,block.output];
            const phase = phases[Math.min(safeStage, phases.length - 1)]; const previous = phases[Math.max(0, Math.min(safeStage - 1, phases.length - 1))];
            description = 'Each point is an actual three-coordinate token representation. Arrows connect the previous calculation to the current stage.';
            phase.forEach((value, time) => { points.push({ position: value, color: PALETTE[time % 6], label: tokens[time].label }); vectors.push({ from: previous[time], to: value, color: PALETTE[time % 6] }); });
        } else if (mode === 'embeddings') {
            description = 'Each token uses a shared, editable three-coordinate embedding lookup. These demonstration coordinates have no pretrained semantic meaning.';
            inputs.forEach((value, time) => { points.push({ position: value, color: PALETTE[time % 6], label: `${time + 1}: ${tokens[time].label}` }); if (time === selected) vectors.push({ from: [0,0,0], to: value, label: 'Selected embedding', color: VIZ.focus }); });
        } else if (mode === 'softmax') {
            axes = ['key index','weight','scaled score']; description = 'Height is a computed softmax weight. Score changes alter a normalized mixture whose weights sum to one.';
            weights.forEach((weight, key) => { const score = selectedHead.scores[selected][key]; boxes.push({ position: [key,weight / 2,Number.isFinite(score) ? score : 0], size: [0.6,Math.max(0.005,weight),0.25], color: PALETTE[key % 6], opacity: 0.8, label: `${key + 1}: ${weight.toFixed(2)}` }); });
        } else if (mode === 'architectures') {
            axes = ['token index','representation magnitude','stream / block']; description = 'Nodes show actual token representation magnitudes. Connections follow the selected attention mask; encoder-decoder mode reads encoder outputs through cross-attention.';
            const sourceLabels = architecture === 'encoder-decoder' ? inputs.map((_, i) => `Encoder ${i + 1}`) : tokens.map(token => token.label);
            selectedHead.keys.forEach((key, index) => { points.push({ position: [index,magnitude(key),0], color: PALETTE[index % 6], label: sourceLabels[index] }); if (weights[index] > 0) paths.push({ points: [[index,magnitude(key),0],[selected,magnitude(selectedHead.queries[selected]),2]], color: VIZ.truth, width: 1 + weights[index] * 9 }); });
            points.push({ position: [selected,magnitude(selectedHead.queries[selected]),2], color: VIZ.focus, label: architecture === 'encoder-decoder' ? 'Decoder query' : 'Selected query' });
        } else if (mode === 'cache' || mode === 'memory' || mode === 'flash' || mode === 'efficient') {
            axes = ['key position','attention weight','query position']; description = 'Links show computed query-key mixing. Height is an attention weight. Past memory, sparse masks, and active tiles change which links are visible.';
            const currentQuery = mode === 'cache' ? Math.min(safeStage, inputs.length - 1) : selected;
            const currentWeights = mode === 'efficient' && efficient === 'linear' ? linear.weights[currentQuery]
                : mode === 'flash' ? selectedHead.scores[currentQuery].map((score, key) => key < liveTile.processed && Number.isFinite(score) && liveTile.denominator > 0
                    ? Math.exp(score - liveTile.maximum) / liveTile.denominator : 0) : selectedHead.weights[currentQuery];
            selectedHead.keys.forEach((_, key) => {
                const weight = currentWeights[key];
                const activeTile = mode !== 'flash' || Math.floor(key / tileSize) === safeStage;
                const visible = mode !== 'cache' || key <= currentQuery;
                points.push({ position: [key,0,0], color: !visible ? '#24405c' : mode === 'memory' && key < memoryLength ? VIZ.output : PALETTE[key % 6], label: !visible ? `Future token ${key + 1}` : mode === 'memory' && key < memoryLength ? `Memory ${key + 1}` : `K${key + 1}` });
                if (weight > 0 && visible) { points.push({ position: [key,weight,currentQuery + 1], color: activeTile ? VIZ.focus : '#24405c', radius: 0.08 }); paths.push({ points: [[key,0,0],[key,weight,currentQuery + 1]], color: activeTile ? VIZ.truth : '#24405c', width: 1 + weight * 10 }); }
            });
            if (mode === 'efficient' && efficient === 'linear') boxes.push({ position: [2,0.4,-1], size: [3,0.1,0.6], color: VIZ.output, label: 'Kernel state: Σ φ(K) Vᵀ' });
        } else if (view === 'values') {
            description = 'Value vectors are mixed using the selected attention weights. The yellow output lies at their weighted centroid; arrows show the accumulated weighted contributions.';
            let accumulated: LabVector = [0,0,0];
            selectedHead.values.forEach((value, key) => { points.push({ position: value, color: PALETTE[key % 6], label: `V${key + 1}: ${weights[key].toFixed(2)}` }); const next = accumulated.map((v, axis) => v + weights[key] * value[axis]) as LabVector; vectors.push({ from: accumulated, to: next, color: PALETTE[key % 6] }); accumulated = next; });
            points.push({ position: selectedHead.outputs[selected], color: VIZ.focus, radius: 0.15, label: 'Weighted value output' });
        } else {
            description = `Query and key vectors share a dot-product space. Color and line width show attention weight. ${position === 'rope' ? 'RoPE rotates the first coordinate pair; the third teaching coordinate is unchanged.' : 'All three coordinates are computed from explicit projection matrices.'}`;
            vectors.push({ from: [0,0,0], to: vec3(selectedHead.queries[selected]), color: VIZ.focus, label: `Q${selected + 1}` });
            selectedHead.keys.forEach((key, index) => { vectors.push({ from: [0,0,0], to: vec3(key), color: weights[index] > 0 ? PALETTE[index % 6] : '#24405c', label: `K${index + 1}` }); paths.push({ points: [vec3(selectedHead.queries[selected]),vec3(key)], color: weights[index] > 0 ? VIZ.truth : '#24405c', width: 0.5 + 8 * weights[index], dashed: weights[index] === 0 }); });
        }
        return { points,paths,vectors,boxes,axes,description };
    }, [mode, inputs, tokens, selected, selectedHead, weights, view, experts, patches, patchSize, block, hybridTrace, architecture, safeStage, linear, tileSize, memoryLength, position, efficient, liveTile]);

    const metrics = mode === 'cache' ? [{ label: 'KV cache (float32)', value: `${cache.retainedElements * 4} B` },{ label: 'Cached / direct error', value: cacheError.toExponential(1) }]
        : mode === 'experts' ? [{ label: 'Accepted routes', value: experts.loads.reduce((a,b) => a+b,0) },{ label: 'Dropped routes', value: experts.dropped }]
            : mode === 'vision' ? [{ label: 'Patches', value: patches.patches.length },{ label: 'Selected patch', value: selected + 1 }]
                : mode === 'flash' ? [{ label: 'Final / dense error', value: Math.max(...tiled.map((v, i) => Math.abs(v - selectedHead.outputs[selected][i]))).toExponential(1) },{ label: 'Live maximum', value: Number.isFinite(liveTile.maximum) ? f(liveTile.maximum) : '−∞' },{label:'Live normalizer',value:f(liveTile.denominator)},{label:'Prefix output norm',value:f(magnitude(liveTile.output))}]
                    : mode === 'hybrid' ? [{ label: 'Retained mixer state', value: `${hybridTrace.cacheByLayer[safeStage] * 4} B` },{ label: 'Shown representation norm', value: f(magnitude(plottedOutput)) }]
                        : mode === 'embeddings' ? [{label:'Embedding norm',value:f(magnitude(plottedOutput))},{label:'Shared lookup entries',value:new Set(tokens.map(token => token.label)).size}]
                            : [{ label: 'Weight sum', value: f(weights.reduce((a,b) => a+b,0)) },{ label: 'Mixing entropy', value: f(entropy) },{ label: mode === 'block' || mode === 'normalization' ? 'Shown representation norm' : 'Projected output norm', value: f(magnitude(plottedOutput)) }];
    const stageNames = ['Input','Attention contribution','Residual addition','Layer normalization','Feed-forward + residual'];
    const explanation = <SceneExplanation title={TITLES[mode]} summary="Manipulate a small numerical model and inspect the resulting vectors. The parameters are demonstration weights; this is not a pretrained language or vision model.">
        <ExplanationSection title="How the space works"><p>{plot.description}</p><p>Point positions, arrow endpoints, ribbon widths, and table entries come from the same forward calculation. The three coordinates are actual teaching dimensions; MLA's four-coordinate query/key calculation is shown through its first three coordinates. Other views label token indices, mixture weights, representation magnitudes, and layout axes explicitly.</p></ExplanationSection>
        <ExplanationSection title="The calculation"><p>Attention computes softmax(QKᵀ / √d)V. Projections create queries, keys, and values. Each head performs its own mixture; concatenated head outputs pass through an output projection. A zero weight means a masked connection. Softmax is a normalized weighting operation, not a guarantee that a head explains model reasoning.</p><p>Transformer blocks add residual paths, normalize representations, and transform each token with a feed-forward network. Pre-normalization and post-normalization place these operations differently. GELU, ReLU, and SwiGLU calculate different feed-forward outputs.</p></ExplanationSection>
        {mode === 'architectures' && <ExplanationSection title="Architecture and objective"><p>Encoder attention can read both directions and supports classification or token labeling. Decoder attention is causal and supports next-token prediction. Encoder-decoder cross-attention uses decoder queries with encoder keys and values for conditional generation such as translation. This view isolates their connectivity; it does not train those tasks.</p></ExplanationSection>}
        {(mode === 'position' || mode === 'memory') && <ExplanationSection title="Order and memory"><p>Bidirectional self-attention without positions is permutation-equivariant. A causal mask already supplies an ordering constraint, so reversing tokens under that mask changes available information. Additive sinusoidal features change input embeddings. RoPE rotates query/key coordinate pairs, making their dot products depend on relative positions. This three-coordinate example rotates one pair. Segment memory stores computed representations from an earlier segment; here the next segment reads fixed memory through a causal mask, illustrating the recurrence idea without reproducing Transformer-XL's complete relative-position formulation.</p><p><a href="https://arxiv.org/abs/2104.09864" target="_blank" rel="noreferrer">RoFormer</a> · <a href="https://arxiv.org/abs/1901.02860" target="_blank" rel="noreferrer">Transformer-XL</a></p></ExplanationSection>}
        {mode === 'cache' && <ExplanationSection title="Cache and head sharing"><p>Cached decoding projects only each new token and retains older keys/values. It agrees numerically with recomputing the same causal head layout. MHA retains K/V per head; GQA shares them among groups; MQA shares one group. Changing the head layout changes the model. MLA here uses a two-coordinate content latent and a separate two-coordinate rotary key; its compressed content reconstructs head-specific K/V. Cache bytes count float32 mixer entries, not total process memory or speed.</p><p><a href="https://arxiv.org/abs/2305.13245" target="_blank" rel="noreferrer">GQA</a> · <a href="https://arxiv.org/abs/2405.04434" target="_blank" rel="noreferrer">MLA</a></p></ExplanationSection>}
        {mode === 'efficient' && <ExplanationSection title="Different mixing rules"><p>The sparse mode uses local connections and token 1 as a global token. The linear mode replaces exponential-softmax attention with the positive feature kernel φ(x)=ELU(x)+1, accumulating Σφ(K)Vᵀ and Σφ(K). Its normalized output equals explicit kernel weighting. It is a different attention formulation. State dimensions remain fixed as sequence length grows; dense and sparse pair counts describe operations, not measured hardware performance.</p><p><a href="https://arxiv.org/abs/2004.05150" target="_blank" rel="noreferrer">Longformer</a> · <a href="https://arxiv.org/abs/2006.16236" target="_blank" rel="noreferrer">Linear attention</a></p></ExplanationSection>}
        {mode === 'experts' && <ExplanationSection title="Routing and capacity"><p>A softmax router chooses the top-k numerical feed-forward experts. Selected weights are renormalized; routes beyond capacity are dropped, leaving their contribution zero. Expert names are indices, not learned semantic specialties. Sparse activation reduces active expert computation; it does not make every parameter active for every token. The capacity experiment exposes imbalance.</p><p><a href="https://arxiv.org/abs/2101.03961" target="_blank" rel="noreferrer">Switch Transformers</a></p></ExplanationSection>}
        {mode === 'vision' && <ExplanationSection title="Images as sequences"><p>Each patch embeds mean brightness plus horizontal and vertical contrast into three coordinates. These explicit features stand in for a learned patch projection. Attention then mixes patch representations with the same mathematics as token attention. The example exposes tokenization and mixing; it does not claim trained image recognition. Vision models use learned features and position information.</p><p><a href="https://arxiv.org/abs/2010.11929" target="_blank" rel="noreferrer">Vision Transformer</a></p></ExplanationSection>}
        {mode === 'flash' && <ExplanationSection title="Exact tiled evaluation"><p>Each tile updates an online-softmax maximum, normalizer, and weighted value accumulator. Earlier accumulators are rescaled when the maximum changes. The result agrees with dense attention within floating-point error. This browser demonstration shows the numerical mechanism; it does not execute a GPU FlashAttention kernel or benchmark memory traffic.</p><p><a href="https://arxiv.org/abs/2205.14135" target="_blank" rel="noreferrer">FlashAttention</a></p></ExplanationSection>}
        {mode === 'hybrid' && <ExplanationSection title="Compose mechanisms"><p>The mixed stack combines causal attention, a selective Mamba-2 core with a residual path, and sparse experts. The comparison stacks use three attention or three state-space blocks. We compare computed state sizes and representations with demonstration weights; this does not establish which architecture achieves better language quality.</p><p><a href="https://arxiv.org/abs/2403.19887" target="_blank" rel="noreferrer">Jamba hybrid architecture</a></p></ExplanationSection>}
        <ExplanationSection title="Assumptions and useful experiments"><p>All inputs are finite vectors and every projection is explicitly fixed. Causal generation assumes future tokens are inaccessible. Position encoding supplies order information. Head count, window size, state dimension, and cache precision determine the operation/storage estimates. Representations use arbitrary coordinates until parameters are learned from a task.</p><p>Use this geometry to understand retrieval, translation connectivity, next-token generation, image patches, and streaming architectures. Try a query magnitude of zero, reverse the token order, switch masks, or change one shared embedding. Inspect what changes before opening the weight table.</p></ExplanationSection>
        <ExplanationSection title="Inspect a value"><p>Selected head output: [{headOutput.map(f).join(', ')}]. Combined projected output: [{combinedOutput.map(f).join(', ')}].</p><p><a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noreferrer">Attention Is All You Need</a></p></ExplanationSection>
    </SceneExplanation>;

    return <VisualLab title={TITLES[mode]} subtitle="Change the vectors and watch the computed connections, mixtures, and representations." metrics={metrics}
        insight={mode === 'block' || mode === 'normalization' ? `Stage: ${stageNames[safeStage]}. Selected representation: [${[block.input,block.attention,block.residual,block.normalized,block.output][safeStage][selected].map(f).join(', ')}].`
            : mode === 'hybrid' ? `Stage ${safeStage}: ${safeStage === 0 ? 'input' : hybridBlocks[safeStage - 1]}. Each point is a computed token representation.`
                : mode === 'embeddings' ? `Selected token ${selected + 1}: ${tokens[selected].label} uses embedding [${inputs[selected].map(f).join(', ')}]. Every occurrence of that token shares this editable lookup entry; the coordinates have no pretrained semantic meaning.`
                    : mode === 'cache' ? `Token ${safeStage + 1}: old keys and values are reused. Direct and cached outputs agree to ${cacheError.toExponential(1)}.`
                    : mode === 'flash' ? `Tile ${safeStage + 1} / ${stages + 1}: ${liveTile.processed} keys processed. Current accumulator [${liveTile.accumulator.map(f).join(', ')}] gives prefix output [${liveTile.output.map(f).join(', ')}].`
                        : mode === 'experts' ? `${experts.dropped} routes exceed capacity. Inspect how top-k and capacity change accepted paths.`
                            : mode === 'vision' ? `Patch ${selected + 1} has [brightness, horizontal contrast, vertical contrast] = [${patches.patches[selected].vector.map(f).join(', ')}].`
                                : `${mode === 'efficient' && efficient === 'linear' ? 'Positive-kernel' : 'Softmax'} weights sum to ${f(weights.reduce((a,b) => a+b,0))}; the strongest key is ${weights.indexOf(Math.max(...weights)) + 1}.`}
        challenge={mode === 'attention' || mode === 'softmax' ? 'Set query magnitude to zero. Which permitted keys receive equal weights?' : mode === 'position' ? 'Reverse the tokens with no position encoding, then repeat with RoPE.' : mode === 'experts' ? 'Increase capacity until no routes are dropped.' : 'Change one control and inspect the geometry before opening Explain.'}
        explanation={explanation} controls={<>
            <LabSelect label={mode === 'vision' ? 'Patch' : mode === 'cache' ? 'Decode through token' : 'Selected token'} value={String(selected)} options={(mode === 'vision' ? patches.patches : tokens).map((_, index) => ({ value: String(index), label: mode === 'vision' ? `Patch ${index + 1}` : `${index + 1}: ${tokens[index].label}` }))} onChange={value => mode === 'cache' ? setStage(Number(value)) : setQuery(Number(value))} />
            {['attention','position','softmax','efficient','architectures','flash','memory','cache'].includes(mode) && <LabRange label="Query magnitude" value={queryScale} min={0} max={6} step={0.1} decimals={1} onChange={setQueryScale} />}
            {['attention','position','softmax','block','normalization'].includes(mode) && <LabSelect label="Attention mask" value={mask} options={[{value:'causal',label:'Causal: past and current'},{value:'bidirectional',label:'Bidirectional: all tokens'},{value:'local',label:'Local + global token'}]} onChange={value => setMask(value as AttentionMask)} />}
            {['attention','position','block','cache','normalization'].includes(mode) && !(mode === 'cache' && layout === 'mla') && <LabSelect label="Position encoding" value={position} options={[{value:'none',label:'None'},{value:'sinusoidal',label:'Additive sine/cosine'},{value:'rope',label:'RoPE: rotate Q/K'}]} onChange={value => setPosition(value as PositionEncoding)} />}
            {['attention','position'].includes(mode) && <LabSelect label="Vector space" value={view} options={[{value:'keys',label:'Query / key space'},{value:'values',label:'Value mixture space'}]} onChange={setView} />}
            {mode === 'position' && <LabRange label="Position offset" value={offset} min={0} max={20} onChange={setOffset} />}
            {mode === 'architectures' && <LabSelect label="Architecture" value={architecture} options={[{value:'encoder',label:'Encoder: BERT-style'},{value:'decoder',label:'Decoder: GPT-style'},{value:'encoder-decoder',label:'Encoder-decoder: cross-attention'}]} onChange={setArchitecture} />}
            {['block','normalization'].includes(mode) && <><LabSelect label="Normalization order" value={normalization} options={[{value:'pre',label:'Pre-normalization'},{value:'post',label:'Post-normalization'}]} onChange={value => setNormalization(value as 'pre'|'post')} /><LabSelect label="Feed-forward activation" value={activation} options={[{value:'gelu',label:'GELU'},{value:'relu',label:'ReLU'},{value:'swiglu',label:'SwiGLU'}]} onChange={value => setActivation(value as 'relu'|'gelu'|'swiglu')} /></>}
            {mode === 'cache' && <LabSelect label="Key/value layout" value={layout} options={[{value:'mha',label:'MHA: separate K/V'},{value:'gqa',label:'GQA: grouped K/V'},{value:'mqa',label:'MQA: shared K/V'},{value:'mla',label:'MLA: latent + rotary key'}]} onChange={value => setLayout(value as KVLayout)} />}
            {mode === 'efficient' && <><LabSelect label="Mixing rule" value={efficient} options={[{value:'dense',label:'Dense causal softmax'},{value:'sparse',label:'Bidirectional local + global softmax'},{value:'linear',label:'Causal positive-kernel recurrence'}]} onChange={setEfficient} /><LabRange label="Local window" value={windowSize} min={1} max={4} onChange={setWindowSize} /></>}
            {mode === 'experts' && <><LabRange label="Experts per token" value={topK} min={1} max={3} onChange={setTopK} /><LabRange label="Capacity factor" value={capacity} min={0.25} max={3} step={0.25} decimals={2} onChange={setCapacity} /></>}
            {mode === 'flash' && <LabRange label="Tile size" value={tileSize} min={1} max={4} onChange={value => { setTileSize(value); setStage(0); }} />}
            {mode === 'memory' && <LabRange label="Previous segment tokens" value={memoryLength} min={0} max={4} onChange={setMemoryLength} />}
            {mode === 'vision' && <><LabSelect label="Image pattern" value={pattern} options={[{value:'stripes',label:'Vertical stripes'},{value:'checker',label:'Checkerboard'},{value:'diagonal',label:'Diagonal'}]} onChange={value => setPattern(value as 'stripes'|'checker'|'diagonal')} /><LabSelect label="Patch edge" value={String(patchSize)} options={[{value:'2',label:'2 × 2: 16 patches'},{value:'4',label:'4 × 4: 4 patches'}]} onChange={value => { setPatchSize(Number(value) as 2|4); setQuery(0); }} /></>}
            {mode === 'hybrid' && <LabSelect label="Block stack" value={hybrid} options={[{value:'mixed',label:'Attention → Mamba-2 → Experts'},{value:'attention',label:'Three attention blocks'},{value:'state',label:'Three state-space blocks'}]} onChange={setHybrid} />}
            {!['experts','vision','hybrid','embeddings'].includes(mode) && <><LabRange label="Attention heads" value={headCount} min={1} max={4} onChange={setHeadCount} /><LabSelect label="Inspect head" value={String(Math.min(headIndex, headCount - 1))} options={Array.from({length:headCount},(_, index) => ({value:String(index),label:`Head ${index + 1}`}))} onChange={value => setHeadIndex(Number(value))} /></>}
            {['block','normalization','cache','flash','hybrid'].includes(mode) && <LabPlayback step={safeStage} max={stages} onStep={setStage} />}
            {mode !== 'vision' && <button type="button" className="lab-button" onClick={() => setEditing(!editing)} aria-expanded={editing}>{editing ? 'Close vector editor' : 'Edit embedding'}</button>}
            {editing && mode !== 'vision' && [0,1,2].map(axis => <LabRange key={axis} label={`Embedding coordinate ${axis + 1}`} value={inputs[Math.min(selected,inputs.length - 1)][axis]} min={-2} max={2} step={0.1} decimals={1} onChange={value => editVector(axis,value)} />)}
            {mode !== 'vision' && <button type="button" className="lab-button" onClick={() => setTokens(current => [...current].reverse())}>Reverse tokens</button>}
            {showsAttentionMatrix && <button type="button" className="lab-button" aria-pressed={matrix} onClick={() => setMatrix(!matrix)}>{matrix ? 'Hide weights' : 'Show weights'}</button>}
        </>}>
        <SpatialScene {...plot} equalScale={!['experts','vision','softmax','architectures','cache','memory','flash','efficient'].includes(mode)} />
        <div className="visual-lab-overlay"><span>Demo weights · actual vector calculations</span><span>{mode === 'block' || mode === 'normalization' ? stageNames[safeStage] : mode === 'experts' ? 'Top-k expert routes' : mode === 'embeddings' ? 'Shared token lookup' : mode === 'hybrid' ? `Stage ${safeStage}: ${safeStage === 0 ? 'input' : hybridBlocks[safeStage - 1]}` : mode === 'cache' ? layout === 'mla' ? 'MLA · fixed decoupled RoPE' : layout.toUpperCase() : mode === 'efficient' ? efficient === 'sparse' ? 'Sparse bidirectional encoder mask' : efficient : `Head ${Math.min(headIndex,headCount - 1) + 1}`}</span></div>
        {matrix && showsAttentionMatrix && <WeightTable head={mode === 'efficient' && efficient === 'linear' ? {...selectedHead,weights:linear.weights}
            : mode === 'cache' ? {...selectedHead,keys:selectedHead.keys.slice(0,decodeCount),weights:selectedHead.weights.slice(0,decodeCount).map(row => row.slice(0,decodeCount))} : selectedHead} labels={mode === 'vision' ? patches.patches.map((_, i) => `p${i + 1}`) : mode === 'memory' ? [...memory.map((_, i) => `m${i + 1}`),...tokens.map(token => token.label)] : tokens.map(token => token.label)} selected={selected} />}
    </VisualLab>;
}
