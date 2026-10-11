import { VIZ } from '../../data/palette';
import { useCallback, useMemo, useState } from 'react';
import { VisualLab, LabRange, LabSelect, LabPlayback } from '../../components/layout/VisualLab';
import { SpatialScene } from '../../components/3d/SpatialScene';
import type { LabVector, SpatialBox, SpatialPath, SpatialPoint, SpatialSceneProps } from '../../components/3d/SpatialScene';
import { TreeDiagram } from '../../components/3d/TreeDiagram';
import { treePartitionGeometry, treeValueColor } from '../../components/3d/tree-partition-geometry';
import { cellCenter, cellContains, treeCells, treeSpaceTrace, treeNodeRule } from '../../utils/ml-tree-space';
import { SceneExplanation, ExplanationSection } from '../../components/layout/SceneExplanation';
import { bundleExclusiveIndicators, decodeExclusiveIndicators, fitBagging, fitBoosting, fitTree,
    outOfBagPredictions, predictBagging, predictBoosting, predictionLoss, predictTree, treeData, treeLeaves, treePath } from '../../utils/ml-trees';
import type { BoostAlgorithm, TreeGrowth, TreeNode, TreeSample, TreeTask } from '../../utils/ml-trees';

export type TreeLabMode = 'tree' | 'bagging' | 'boosting' | 'xgboost' | 'lightgbm';
interface TreeLabProps { mode?: TreeLabMode }
type View = 'partition' | 'prediction' | 'structure' | 'loss' | 'variance' | 'bundle';
const TITLES: Record<TreeLabMode, string> = { tree: 'Decision Trees', bagging: 'Bagging & Random Forests',
    boosting: 'Boosting', xgboost: 'XGBoost: Newton Tree Boosting', lightgbm: 'LightGBM: Histogram & Leafwise Growth' };
const COLORS = { positive: VIZ.focus, negative: VIZ.data, selected: '#f9fafb', correction: VIZ.truth };
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
const variance = (values: number[]) => values.reduce((sum, value) => sum + (value - average(values)) ** 2, 0) / Math.max(1, values.length - 1);
const format = (value: number) => Math.abs(value) >= 1000 || (value !== 0 && Math.abs(value) < 0.001) ? value.toExponential(2) : value.toFixed(3);

function leafRegions(tree: TreeNode, query: readonly number[], task: TreeTask): SpatialBox[] {
    const cells = treeCells(tree, query.map(() => -1), query.map(() => 1)).filter(cell => !cell.node.left || !cell.node.right);
    const min = Math.min(...cells.map(cell => cell.node.value)); const max = Math.max(...cells.map(cell => cell.node.value));
    return cells.filter(cell => query.length === 2 || (query[2] > cell.min[2] || cell.minInclusive[2] && query[2] === cell.min[2])
        && (query[2] < cell.max[2] || cell.maxInclusive[2] && query[2] === cell.max[2])).map(cell => ({
        position: [(cell.min[0] + cell.max[0]) / 2, cell.node.value, (cell.min[1] + cell.max[1]) / 2],
        size: [cell.max[0] - cell.min[0], 0.025, cell.max[1] - cell.min[1]], color: treeValueColor(cell.node.value, task, min, max), opacity: 0.45,
    }));
}

export default function TreeLab({ mode = 'tree' }: TreeLabProps) {
    const [task, setTask] = useState<TreeTask>(mode === 'tree' || mode === 'bagging' ? 'classification' : 'regression');
    const [algorithm, setAlgorithm] = useState<BoostAlgorithm>('gradient');
    const [depth, setDepth] = useState(3); const [minLeaf, setMinLeaf] = useState(3);
    const [pruning, setPruning] = useState(0); const [rounds, setRounds] = useState(12);
    const [learningRate, setLearningRate] = useState(0.3); const [lambda, setLambda] = useState(1);
    const [gamma, setGamma] = useState(0); const [bins, setBins] = useState(8); const [maxLeaves, setMaxLeaves] = useState(8);
    const [dimensions, setDimensions] = useState<2 | 3>(mode === 'tree' ? 3 : 2); const [features, setFeatures] = useState(2); const [growth, setGrowth] = useState<TreeGrowth>('depthwise');
    const [goss, setGoss] = useState(false); const [noise, setNoise] = useState(0.15); const [seed, setSeed] = useState(3610);
    const [step, setStep] = useState(mode === 'tree' ? 0 : 1); const [pathStep, setPathStep] = useState(0); const [view, setView] = useState<View>('partition');
    const [probeX, setProbeX] = useState(0.3); const [probeZ, setProbeZ] = useState(0.3); const [probeY, setProbeY] = useState(0.3);
    const effectiveTask = mode === 'boosting' && algorithm === 'adaboost' ? 'classification' : task;
    const train = useMemo(() => treeData(effectiveTask, 48, noise, seed, dimensions), [effectiveTask, noise, seed, dimensions]);
    const test = useMemo(() => treeData(effectiveTask, 160, noise, seed + 100000, dimensions), [effectiveTask, noise, seed, dimensions]);
    const model = useMemo(() => {
        const options = { task: effectiveTask, maxDepth: depth, minLeaf, pruning, seed, maxFeatures: mode === 'bagging' ? features : dimensions };
        return {
            tree: mode === 'tree' ? fitTree(train, options) : undefined,
            forest: mode === 'bagging' ? fitBagging(train, rounds, options) : undefined,
            boost: mode !== 'tree' && mode !== 'bagging' ? fitBoosting(train, { ...options,
                algorithm: mode === 'boosting' ? algorithm : mode, rounds, learningRate, lambda, gamma,
                bins, maxLeaves: mode === 'xgboost' || mode === 'lightgbm' ? maxLeaves : undefined, growth, goss }) : undefined,
        };
    }, [effectiveTask, depth, minLeaf, pruning, seed, features, mode, train, rounds, algorithm, learningRate, lambda, gamma, bins, maxLeaves, growth, goss, dimensions]);
    const probe = useMemo(() => dimensions === 3 ? [probeX, probeZ, probeY] : [probeX, probeZ], [probeX, probeZ, probeY, dimensions]);
    const probePath = useMemo(() => model.tree ? treePath(model.tree, probe) : [], [model.tree, probe]);
    const maxStep = model.tree ? Math.max(0, probePath.length - 1) : model.forest?.length ?? model.boost?.rounds.length ?? 0;
    const visibleStep = Math.min(step, maxStep);
    const selectedRound = visibleStep > 0 ? model.boost?.rounds[visibleStep - 1] : undefined;
    const selectedBag = visibleStep > 0 ? model.forest?.[visibleStep - 1] : undefined;
    const selectedTree = model.tree ?? (visibleStep > 0 ? selectedBag?.tree ?? selectedRound?.tree : undefined);
    const selectedTrace = useMemo(() => selectedTree ? treeSpaceTrace(selectedTree, probe) : undefined, [selectedTree, probe]);
    const decisionStep = Math.min(mode === 'tree' ? visibleStep : pathStep, (selectedTrace?.path.length ?? 1) - 1);
    const activeCell = selectedTrace?.path[decisionStep];
    const baseline = average(train.map(row => row.y));
    const predict = useCallback((x: readonly number[]) => model.tree ? predictTree(model.tree, x)
        : model.forest ? visibleStep > 0 ? predictBagging(model.forest.slice(0, visibleStep), x) : baseline
            : model.boost ? predictBoosting(model.boost, x, visibleStep) : baseline, [model, visibleStep, baseline]);
    const trainPredictions = useMemo(() => train.map(row => predict(row.x)), [train, predict]);
    const testPredictions = useMemo(() => test.map(row => predict(row.x)), [test, predict]);
    const metric = (rows: TreeSample[], predictions: number[]) => effectiveTask === 'classification'
        ? `${(100 * rows.filter((row, index) => (predictions[index] >= 0.5 ? 1 : 0) === row.y).length / rows.length).toFixed(1)}%`
        : format(predictionLoss(rows, predictions, 'regression'));
    const oob = model.forest ? outOfBagPredictions(model.forest.slice(0, visibleStep), train) : [];
    const covered = train.filter((_, i) => oob[i] !== null && oob[i] !== undefined);
    const oobValues = oob.filter((value): value is number => value !== null);
    const closest = train.reduce((best, row, index) => Math.hypot(...row.x.map((value, axis) => value - probe[axis]))
        < Math.hypot(...train[best].x.map((value, axis) => value - probe[axis])) ? index : best, 0);
    const currentNode = activeCell?.node;
    const bootstrapReplicates = useMemo(() => mode === 'bagging' && view === 'variance'
        ? Array.from({ length: 8 }, (_, index) => fitBagging(train, rounds, { task: effectiveTask, maxDepth: depth, minLeaf, maxFeatures: features, seed: seed + index * 7919 })) : [],
    [mode, view, train, rounds, effectiveTask, depth, minLeaf, features, seed]);
    const singlePredictions = useMemo(() => bootstrapReplicates.map(forest => predictTree(forest[0].tree, probe)), [bootstrapReplicates, probe]);
    const aggregatePredictions = useMemo(() => bootstrapReplicates.map(forest => visibleStep ? predictBagging(forest.slice(0, visibleStep), probe) : baseline), [bootstrapReplicates, visibleStep, probe, baseline]);
    const bundleRows = useMemo(() => train.map(row => [row.x[0] > 0.35 ? 1 : 0, row.x[0] < -0.35 ? 1 : 0]), [train]);
    const bundle = useMemo(() => bundleExclusiveIndicators(bundleRows), [bundleRows]);
    const decoded = useMemo(() => decodeExclusiveIndicators(bundle), [bundle]);

    const geometry = useMemo<SpatialSceneProps>(() => {
        if (view === 'partition' || view === 'structure') {
            const colors = train.map((row, i) => selectedBag && selectedBag.inBag[i] === 0 ? VIZ.axis
                : selectedRound?.sampling ? selectedRound.sampling.large.includes(i) ? COLORS.positive : selectedRound.sampling.small.includes(i) ? COLORS.correction : VIZ.axis
                    : effectiveTask === 'classification' ? row.y ? COLORS.positive : COLORS.negative : treeValueColor(row.y, 'regression', Math.min(...train.map(sample => sample.y)), Math.max(...train.map(sample => sample.y))));
            const radii = train.map((_, i) => selectedBag ? 0.075 + 0.025 * Math.sqrt(selectedBag.inBag[i])
                : mode === 'boosting' && algorithm === 'adaboost' && selectedRound ? 0.07 + 0.06 * Math.sqrt(selectedRound.weights[i] * train.length) : 0.09);
            if (selectedTree) return treePartitionGeometry({ tree: selectedTree, query: probe, step: decisionStep, samples: train,
                task: model.boost ? 'regression' : effectiveTask, colors, radii, title: TITLES[mode] });
            return { points: [...train.map((row, i) => ({ position: [row.x[0], dimensions === 3 ? row.x[2] : 0.05, row.x[1]] as LabVector,
                color: colors[i], radius: radii[i] })), { position: [probeX, dimensions === 3 ? probeY : 0.08, probeZ] as LabVector, color: VIZ.white, label: 'query' }],
                boxes: dimensions === 2 ? [{ position: [0, 0, 0] as LabVector, size: [2, 0.015, 2] as LabVector, color: VIZ.axis, opacity: 0.15 }] : [],
                axes: dimensions === 3 ? ['Feature x₁', 'Feature x₃', 'Feature x₂'] : ['Feature x₁', 'Illustrative height', 'Feature x₂'],
                description: 'Input feature space before any tree is included. Step to add a fitted tree and inspect its exact threshold partitions.' };
        }
        if (view === 'variance') return { points: singlePredictions.flatMap((value, i): SpatialPoint[] => [
            { position: [i, value, 0], color: COLORS.negative }, { position: [i, aggregatePredictions[i], 1], color: COLORS.positive }]),
            paths: [{ points: singlePredictions.map((value, i): LabVector => [i, value, 0]), color: COLORS.negative },
                { points: aggregatePredictions.map((value, i): LabVector => [i, value, 1]), color: COLORS.positive }],
            axes: ['Independent bootstrap replicate', 'Query prediction', 'Single tree 0 / ensemble 1'] as const,
            equalScale: false,
            description: 'Eight independent bootstrap ensembles fitted to the same original dataset: blue single-tree predictions and gold ensemble predictions at the query. This measures conditional bootstrap variability. Axes scale separately for readability.' };
        if (view === 'bundle') return { points: bundle.slice(0, 16).flatMap((code, i): SpatialPoint[] => [
            { position: [i, bundleRows[i][0], 0], color: COLORS.positive }, { position: [i, bundleRows[i][1], 1], color: COLORS.negative },
            { position: [i, code, 2], color: COLORS.correction, label: i < 3 ? `code ${code}` : undefined }]),
            axes: ['Training row', 'Indicator / bundle code', 'Original features 0,1 / packed 2'] as const,
            equalScale: false,
            description: 'Exact exclusive-feature packing experiment: two disjoint binary indicators become one code, with lossless decoding. Dense training features are not bundled. Axes scale separately for readability.' };
        if (view === 'loss' && model.boost) {
            const initial = predictionLoss(train, train.map(row => predictBoosting(model.boost!, row.x, 0)), effectiveTask);
            const losses = [initial, ...model.boost.rounds.map(round => round.loss)];
            return { paths: [{ points: losses.slice(0, visibleStep + 1).map((loss, i): LabVector => [i, loss, 0]), color: COLORS.positive }],
                points: losses.slice(0, visibleStep + 1).map((loss, i): SpatialPoint => ({ position: [i, loss, 0], color: COLORS.correction,
                    label: i === visibleStep ? `loss ${format(loss)}` : undefined })),
                axes: ['Added trees', effectiveTask === 'classification' ? 'Training log loss' : 'Training MSE', 'Zero'] as const,
                equalScale: false,
                description: 'Measured training loss after each actual additive update. Held-out error is evaluated separately; training improvement does not guarantee generalization. Axes scale separately for readability.' };
        }
        const points: SpatialPoint[] = train.map((row, i) => ({ position: [row.x[0], row.y, row.x[1]],
            color: selectedBag && selectedBag.inBag[i] === 0 ? VIZ.axis
                : selectedRound?.sampling ? selectedRound.sampling.large.includes(i) ? COLORS.positive : selectedRound.sampling.small.includes(i) ? COLORS.correction : VIZ.axis
                    : effectiveTask === 'classification' ? row.y ? COLORS.positive : COLORS.negative : VIZ.variation,
            radius: selectedBag ? 0.025 + 0.02 * Math.sqrt(selectedBag.inBag[i])
                : mode === 'boosting' && algorithm === 'adaboost' && selectedRound ? 0.025 + 0.045 * Math.sqrt(selectedRound.weights[i] * train.length) : 0.045,
            label: i === closest ? `row ${i + 1}` : undefined }));
        points.push({ position: [probeX, predict(probe), probeZ], color: COLORS.selected, radius: 0.09, label: `query ${format(predict(probe))}` });
        const residuals: SpatialPath[] = train.map((row, i) => ({ points: [[row.x[0], trainPredictions[i], row.x[1]], [row.x[0], row.y, row.x[1]]],
            color: VIZ.axis, width: 1 }));
        const vertices = Array.from({ length: 17 * 17 }, (_, i): LabVector => {
            const x = -1 + (i % 17) / 8; const z = -1 + Math.floor(i / 17) / 8;
            return [x, predict(dimensions === 3 ? [x, z, probeY] : [x, z]), z];
        });
        return { points, paths: residuals, boxes: model.tree ? leafRegions(model.tree, probe, effectiveTask) : [],
            surfaces: model.tree ? [] : [{ vertices, columns: 17, color: COLORS.correction, opacity: 0.35 }],
            axes: ['Feature x₁', effectiveTask === 'classification' ? 'Class score / target' : 'Prediction / target', 'Feature x₂'] as const,
            description: `${TITLES[mode]} fitted prediction space${dimensions === 3 ? ` at the fixed x₃=${probeY.toFixed(2)} slice (training targets from all x₃ values remain visible)` : ''}: observed training points, the white query prediction, and residual lines. ${model.tree ? 'Each flat region is an exact leaf prediction.' : 'The mesh interpolates a 17 by 17 grid of actual predictions; tree boundaries can lie between samples.'}` };
    }, [view, selectedTree, model, visibleStep, probe, mode, singlePredictions, aggregatePredictions, bundle, bundleRows,
        train, effectiveTask, selectedBag, algorithm, selectedRound, closest, probeX, probeZ, probeY, predict, trainPredictions, dimensions, decisionStep]);

    const viewOptions = [{ value: 'partition', label: 'Input space & threshold partitions' }, { value: 'prediction', label: 'Prediction height & target' }, { value: 'structure', label: 'Linked fitted-tree diagram' },
        ...(mode === 'bagging' ? [{ value: 'variance', label: 'Bootstrap prediction variance' }] : []),
        ...(mode !== 'tree' && mode !== 'bagging' ? [{ value: 'loss', label: 'Actual training loss by round' }] : []),
        ...(mode === 'lightgbm' ? [{ value: 'bundle', label: 'Exclusive feature packing experiment' }] : [])];
    const controls = <>
        <LabSelect label="Input feature space" value={String(dimensions)} options={[{ value: '2', label: 'Two features: floor' }, { value: '3', label: 'Three real features: cube' }]}
            onChange={value => { const count = Number(value) as 2 | 3; setDimensions(count); setFeatures(count); setStep(mode === 'tree' ? 0 : 1); setPathStep(0); }} />
        <LabSelect label="Target task" value={effectiveTask} options={[{ value: 'classification', label: 'Binary classification' }, { value: 'regression', label: 'Numeric regression' }]}
            onChange={value => { setTask(value as TreeTask); if (value === 'regression') setAlgorithm('gradient'); }} />
        <LabSelect label="Visualization" value={view} options={viewOptions} onChange={value => setView(value as View)} />
        {mode === 'boosting' && <LabSelect label="Boosting algorithm" value={algorithm} options={[{ value: 'gradient', label: 'Gradient / residual boosting' }, { value: 'adaboost', label: 'AdaBoost weighted stumps' }]}
            onChange={value => { setAlgorithm(value as BoostAlgorithm); setStep(1); }} />}
        {mode === 'boosting' && algorithm === 'adaboost' ? <span>AdaBoost uses weighted decision stumps (depth 1).</span> : <>
            <LabRange label="Maximum tree depth" value={depth} min={1} max={5} onChange={setDepth} />
            <LabRange label="Minimum samples per leaf" value={minLeaf} min={1} max={10} onChange={setMinLeaf} />
        </>}
        {mode === 'tree' && <LabRange label="Cost complexity pruning α" value={pruning} min={0} max={0.3} step={0.01} decimals={2} onChange={setPruning} />}
        {mode !== 'tree' && <LabRange label="Number of trees" value={rounds} min={1} max={20} onChange={setRounds} />}
        {mode === 'bagging' && <LabSelect label="Features considered at each split" value={String(features)} options={[{ value: String(dimensions), label: 'All features: bagging' }, { value: '1', label: 'One random feature: random forest' }]} onChange={value => setFeatures(Number(value))} />}
        {mode !== 'tree' && mode !== 'bagging' && <LabRange label="Learning rate η" value={learningRate} min={0.05} max={1} step={0.05} decimals={2} onChange={setLearningRate} />}
        {(mode === 'xgboost' || mode === 'lightgbm') && <>
            <LabRange label="Leaf penalty λ" value={lambda} min={0} max={10} step={0.5} decimals={1} onChange={setLambda} />
            <LabRange label="Split penalty γ" value={gamma} min={0} max={2} step={0.05} decimals={2} onChange={setGamma} />
            <LabRange label="Maximum leaves" value={maxLeaves} min={2} max={16} onChange={setMaxLeaves} />
        </>}
        {mode === 'xgboost' && <LabSelect label="Teaching tree growth policy" value={growth} options={[{ value: 'depthwise', label: 'Grow by depth' }, { value: 'leafwise', label: 'Grow largest gain first' }]} onChange={value => setGrowth(value as TreeGrowth)} />}
        {mode === 'lightgbm' && <>
            <LabRange label="Histogram bins per feature" value={bins} min={2} max={16} onChange={setBins} />
            <LabSelect label="Gradient sampling" value={goss ? 'goss' : 'all'} options={[{ value: 'all', label: 'Use all rows' }, { value: 'goss', label: 'GOSS: keep large gradients + sample small' }]} onChange={value => setGoss(value === 'goss')} />
        </>}
        <LabRange label="Observation noise σ" value={noise} min={0} max={0.5} step={0.05} decimals={2} onChange={setNoise} />
        <LabRange label="Query feature x₁" value={probeX} min={-1} max={1} step={0.05} decimals={2} onChange={setProbeX} />
        <LabRange label="Query feature x₂" value={probeZ} min={-1} max={1} step={0.05} decimals={2} onChange={setProbeZ} />
        {dimensions === 3 && <LabRange label="Query feature x₃" value={probeY} min={-1} max={1} step={0.05} decimals={2} onChange={setProbeY} />}
        {mode !== 'tree' && selectedTree && <LabRange label="Decision along query path" value={decisionStep} min={0} max={Math.max(0, (selectedTrace?.path.length ?? 1) - 1)} onChange={setPathStep} />}
        <LabPlayback step={visibleStep} max={maxStep} onStep={value => { setStep(value); if (mode !== 'tree') setPathStep(0); }} />
        <button type="button" className="lab-button" onClick={() => { setSeed(current => current + 1); setStep(mode === 'tree' ? 0 : 1); setPathStep(0); }}>Resample data</button>
    </>;
    let insight = mode === 'tree'
        ? view === 'prediction' ? `Height means prediction or target in this view. The input-space view instead puts observations at their feature coordinates and uses colors for responses.`
            : `Each Step follows one exact threshold decision. The white region retains the query; gray observations were excluded earlier. Teal marks the next cut and arrow into the chosen child. Open the linked diagram to inspect any branch.`
        : mode === 'bagging' ? `${visibleStep} bootstrap trees averaged. The input space shows the selected tree ${visibleStep}; its partition prediction can differ from the ensemble average. Closest row ${closest + 1} occurs ${selectedBag?.inBag[closest] ?? 0} times; gray rows are out of bag or excluded by the inspected path.`
            : `${visibleStep} actual additive updates. Input-space colors show the selected correction tree, not the total prediction. Selected correction at query: ${format(selectedTree ? predictTree(selectedTree, probe) : 0)}; learning multiplier: ${format(selectedRound?.alpha ?? learningRate)}.`;
    if (view === 'variance') insight = `Eight independent bootstrap fits: single-tree variance ${format(variance(singlePredictions))}, ensemble variance ${format(variance(aggregatePredictions))}. Variation is conditional on this original dataset; reduction is not guaranteed for every finite sample.`;
    if (view === 'bundle') insight = `Two exclusive binary indicators are stored as one code (0 neither, 1 first, 2 second). ${decoded.filter((row, i) => row.every((value, j) => value === bundleRows[i][j])).length}/48 rows decode exactly. This packing experiment does not bundle the dense training features.`;
    if ((mode === 'xgboost' || mode === 'lightgbm') && view === 'structure' && currentNode) insight += ` Inspected node statistics: G=${format(currentNode.gradient ?? 0)}, H=${format(currentNode.hessian ?? 0)}; w=−G/(H+λ)=${format(currentNode.value)}; split gain=${format(currentNode.gain ?? 0)}.`;
    if (mode === 'lightgbm' && selectedRound?.sampling) insight += ` GOSS retained ${selectedRound.sampling.kept.length}/48 rows: gold large-gradient, teal sampled small-gradient, gray omitted. Sampled small-gradient rows carry weight ${format(selectedRound.sampling.correction)}.`;
    if (mode === 'boosting' && algorithm === 'adaboost') insight += ' Marker sizes show actual pre-round example weights; misclassified examples receive more relative weight. AdaBoost scores are not calibrated probabilities.';

    const explanation = <SceneExplanation title={TITLES[mode]} summary="The displayed models are fitted numerically to 48 synthetic training rows; 160 independent rows measure held-out performance.">
        <ExplanationSection title="Read and manipulate the space"><p>{dimensions === 3 ? 'The current input-space view is a genuine x₁/x₂/x₃ cube. Each threshold wall cuts the actual feature volume, and no prediction is a coordinate.' : 'The current input-space view places observations on the x₁/x₂ floor. Threshold-wall height is illustrative, not a feature or prediction.'} Threshold walls are clipped to the current node region. Use Input feature space to compare the two-feature floor and the three-feature cube. The white outline retains the query; observations outside it dim as you follow the path. Leaf color represents class-1 fraction or tree value. The linked screen-space diagram gives exact parent-child structure; select any node to move the query to its region. The separate prediction view uses feature x₁ horizontally, target or class score vertically, and feature x₂ in depth. Colored observations are training data; vertical lines connect their observed targets to predictions. Move the displayed Query feature sliders and inspect its white marker. For three-feature prediction height, the fitted surface is a slice at the query x₃, while training targets from all x₃ values remain visible. Switch to the diagram to follow exact threshold decisions. The ensemble mesh is a sampled surface, so its interpolation is not an exact boundary drawing.</p></ExplanationSection>
        <ExplanationSection title="What is actually computed"><p>{mode === 'tree' ? 'Binary CART searches all midpoint thresholds. Classification minimizes weighted Gini impurity; regression minimizes squared error. Leaves predict the class fraction or response mean. Post-pruning compares normalized leaf risk plus α times the number of leaves, so a large penalty collapses unhelpful subtrees.'
            : mode === 'bagging' ? 'Each tree fits 48 draws with replacement from the original dataset. All-feature splits produce bagging; choosing one random feature per node produces a small random forest. Predictions average leaf values. OOB prediction for a row uses only trees whose bootstrap omitted that row; rows with no eligible tree are excluded and coverage is reported.'
                : mode === 'boosting' ? 'Gradient boosting starts from a constant prediction, fits a regression tree to negative gradients (ordinary residuals for half squared error), and adds η times the tree. Binary classification uses sigmoid scores and cross-entropy gradients. AdaBoost instead fits weighted binary stumps, computes their actual weighted error, assigns α = η/2 log((1−error)/error), and multiplies row weights by exp(−α target prediction) before normalization.'
                    : 'Each round computes gradients and Hessians of half squared error (g=prediction−target, h=1), or logistic loss (g=p−target, h=p(1−p)). A leaf contributes w=−Σg/(Σh+λ). Split gain is half of G_left²/(H_left+λ)+G_right²/(H_right+λ)−G_parent²/(H_parent+λ), minus γ. The final score adds η times each tree.'}</p>
            {mode === 'xgboost' && <p>This scoped XGBoost teaching engine offers exact midpoint splits and both depth-based and largest-gain growth. XGBoost is not inherently restricted to depthwise trees; production configurations also differ in split search and engineering optimizations.</p>}
            {mode === 'lightgbm' && <p>This scoped LightGBM teaching engine restricts candidates to global quantile histogram boundaries and repeatedly grows the leaf with greatest positive gain, subject to depth and leaf limits. Its GOSS experiment keeps the largest 25% of absolute gradients, samples 25% of all rows from the remainder, and weights sampled rows by remaining-count/sample-count in both gradient and Hessian sums. It demonstrates numerical sampling, not production throughput. The exclusive-bundling view is a separate exact packing exercise on two disjoint indicator features; arbitrary dense columns cannot be packed this way.</p>}
        </ExplanationSection>
        <ExplanationSection title="Assumptions, limitations, and uses"><p>Splits are greedy and axis aligned. Training and held-out data here follow the same synthetic process; real deployment needs representative validation, missing-value handling, and appropriate features. Trees can explain tabular decisions, forests can stabilize noisy tabular estimates, and boosted trees can model nonlinear tabular interactions. None guarantees better held-out performance. Leaf fractions and AdaBoost score transforms need not be calibrated probabilities. Features are numeric, finite, and complete in this teaching engine.</p></ExplanationSection>
        <ExplanationSection title="Primary references"><p><a href="https://scikit-learn.org/stable/modules/tree.html" target="_blank" rel="noreferrer">Decision tree mathematics and pruning</a> · <a href="https://scikit-learn.org/stable/modules/ensemble.html" target="_blank" rel="noreferrer">Bagging, random forests, and boosting</a> · <a href="https://arxiv.org/abs/1603.02754" target="_blank" rel="noreferrer">Chen & Guestrin: XGBoost</a> · <a href="https://proceedings.neurips.cc/paper/2017/hash/6449f44a102fde848669bdd9eb6b76fa-Abstract.html" target="_blank" rel="noreferrer">Ke et al.: LightGBM</a></p></ExplanationSection>
    </SceneExplanation>;
    const metrics = [{ label: effectiveTask === 'classification' ? 'Train accuracy' : 'Train MSE', value: metric(train, trainPredictions) },
        { label: effectiveTask === 'classification' ? 'Held-out accuracy' : 'Held-out MSE', value: metric(test, testPredictions) },
        { label: mode === 'tree' ? 'Leaf count' : 'Trees included', value: mode === 'tree' ? treeLeaves(model.tree!).length : visibleStep },
        { label: 'Query prediction', value: format(predict(probe)) },
        ...(mode === 'bagging' ? [{ label: 'OOB coverage', value: `${covered.length}/48` }, { label: 'OOB score', value: covered.length ? metric(covered, oobValues) : 'Not available' }] : [])];
    return <VisualLab title={TITLES[mode]} subtitle="Cut the input space, follow the query through regions, and compare fitted predictions." controls={controls}
        metrics={metrics} insight={insight} explanation={explanation} challenge={mode === 'tree' ? 'Increase depth, then increase pruning. Compare the number of leaves and held-out error.'
            : mode === 'bagging' ? 'Choose one random feature at each split, switch to bootstrap variance, and step through ensemble size.'
                : mode === 'lightgbm' ? 'Reduce histogram bins, toggle GOSS, then inspect the tree gain and held-out score.' : 'Step through added trees, then compare learning rates on the actual loss trace.'}>
        <div className="tree-space-layout">
            {view === 'prediction' && <div className="tree-rule-bar">
                <strong>Height = prediction or observed target</strong>
                <span>The floor axes are x₁ and x₂; white marks the query prediction.</span>
                {dimensions === 3 && <span>Prediction slice: x₃ = {probeY.toFixed(2)}. Training targets from all x₃ values remain visible.</span>}
            </div>}
            {(view === 'partition' || view === 'structure') && <div className="tree-rule-bar" aria-live="polite">
                {activeCell && currentNode ? <>
                    <strong>{treeNodeRule(currentNode)}</strong>
                    <span>{currentNode.feature === undefined ? `Leaf reached: selected tree predicts ${format(currentNode.value)}.`
                        : `Query x${currentNode.feature + 1}=${format(probe[currentNode.feature])} ${probe[currentNode.feature] <= currentNode.threshold! ? '≤' : '>'} ${format(currentNode.threshold!)} → ${probe[currentNode.feature] <= currentNode.threshold! ? 'left: lower feature values' : 'right: higher feature values'}.`}</span>
                    <span>{train.filter(row => cellContains(activeCell, row.x)).length}/{train.length} observations in the white region</span>
                    {mode === 'tree' && <span>{effectiveTask === 'classification' ? 'Node Gini' : 'Node target variance'} = {format(currentNode.risk / Math.max(1, currentNode.indices.length))}
                        {currentNode.feature !== undefined ? `; ${effectiveTask === 'classification' ? 'weighted Gini' : 'SSE'} reduction = ${format(currentNode.gain ?? 0)}` : ''}</span>}
                    <span>Region blue → gold: {model.boost ? 'lower → higher correction' : effectiveTask === 'classification' ? 'class-1 fraction 0 → 1' : 'lower → higher leaf value'}</span>
                    <span>{selectedRound?.sampling ? 'Points: gold large gradients; teal sampled; gray omitted/excluded' : mode === 'bagging' ? 'Gray points: out of bag or excluded' : effectiveTask === 'classification' ? 'Points: blue class 0; gold class 1; gray excluded' : 'Points: blue low target; gold high target; gray excluded'}</span>
                </> : <span>No tree included yet. Step to inspect the first fitted partition.</span>}
            </div>}
            <div className={view === 'structure' ? 'tree-diagram-view' : 'tree-space-main'}>
                {view === 'structure' && selectedTree && selectedTrace ? <>
                    <TreeDiagram tree={selectedTree} path={selectedTrace.path.map(cell => cell.node)} selectedId={currentNode?.id ?? selectedTree.id}
                        onSelect={node => { const cell = selectedTrace.cells.find(candidate => candidate.node.id === node.id)!; const center = cellCenter(cell);
                            setProbeX(center[0]); setProbeZ(center[1]); if (dimensions === 3) setProbeY(center[2]);
                            if (mode === 'tree') setStep(node.depth); else setPathStep(node.depth); }} />
                    <p className="tree-diagram-hint">Gold follows the query; white ring marks the inspected node. Left edges: ≤. Right edges: &gt;. Select a node to move the query into its region. Graph height means depth, not a feature.</p>
                    <button type="button" className="lab-button" onClick={() => setView('partition')}>Return to input space</button>
                </> : <SpatialScene {...geometry} />}
                {view === 'partition' && selectedTree && selectedTrace && <div className="tree-linked-diagram">
                    <TreeDiagram tree={selectedTree} path={selectedTrace.path.map(cell => cell.node)} selectedId={currentNode?.id ?? selectedTree.id} compact />
                    <button type="button" className="lab-button" onClick={() => setView('structure')}>Open linked tree</button>
                </div>}
            </div>
            {(view === 'partition' || view === 'structure') && selectedTrace && <nav className="tree-path-buttons" aria-label="Query decision path">
                {selectedTrace.path.map((cell, index) => <button type="button" className="lab-button" key={cell.node.id} aria-current={index === decisionStep ? 'step' : undefined}
                    onClick={() => { if (mode === 'tree') setStep(index); else setPathStep(index); }}>{index + 1}. {treeNodeRule(cell.node)}</button>)}
            </nav>}
        </div>
    </VisualLab>;
}
