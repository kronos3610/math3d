import { useCallback, useMemo, useState } from 'react';
import { VisualLab, LabRange, LabSelect, LabPlayback } from '../../components/layout/VisualLab';
import { SpatialScene } from '../../components/3d/SpatialScene';
import type { LabVector, SpatialBox, SpatialPath, SpatialPoint, SpatialSceneProps } from '../../components/3d/SpatialScene';
import { SceneExplanation, ExplanationSection } from '../../components/layout/SceneExplanation';
import { bundleExclusiveIndicators, decodeExclusiveIndicators, fitBagging, fitBoosting, fitTree,
    outOfBagPredictions, predictBagging, predictBoosting, predictionLoss, predictTree, treeData, treeLeaves, treePath } from '../../utils/ml-trees';
import type { BoostAlgorithm, TreeGrowth, TreeNode, TreeSample, TreeTask } from '../../utils/ml-trees';

export type TreeLabMode = 'tree' | 'bagging' | 'boosting' | 'xgboost' | 'lightgbm';
interface TreeLabProps { mode?: TreeLabMode }
type View = 'prediction' | 'structure' | 'loss' | 'variance' | 'bundle';
const TITLES: Record<TreeLabMode, string> = { tree: 'Decision Trees', bagging: 'Bagging & Random Forests',
    boosting: 'Boosting', xgboost: 'XGBoost: Newton Tree Boosting', lightgbm: 'LightGBM: Histogram & Leafwise Growth' };
const COLORS = { positive: '#fbbf24', negative: '#60a5fa', selected: '#f9fafb', correction: '#2dd4bf' };
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
const variance = (values: number[]) => values.reduce((sum, value) => sum + (value - average(values)) ** 2, 0) / Math.max(1, values.length - 1);
const format = (value: number) => Math.abs(value) >= 1000 || (value !== 0 && Math.abs(value) < 0.001) ? value.toExponential(2) : value.toFixed(3);

function drawTree(tree: TreeNode, highlighted: Set<number>) {
    const leaves = treeLeaves(tree);
    const positions = new Map<TreeNode, LabVector>();
    const points: SpatialPoint[] = []; const paths: SpatialPath[] = [];
    const position = (node: TreeNode): LabVector => {
        const x = node.left && node.right ? (position(node.left)[0] + position(node.right)[0]) / 2
            : leaves.length === 1 ? 0 : -1 + 2 * leaves.indexOf(node) / (leaves.length - 1);
        const point: LabVector = [x, -node.depth, node.value]; positions.set(node, point); return point;
    };
    position(tree);
    const visit = (node: TreeNode) => {
        const point = positions.get(node)!;
        const label = node.feature !== undefined ? `x${node.feature + 1} ≤ ${node.threshold?.toFixed(2)}` : `leaf ${format(node.value)}`;
        points.push({ position: point, color: highlighted.has(node.id) ? COLORS.positive : COLORS.correction, radius: 0.1, label });
        for (const child of [node.left, node.right]) if (child) {
            paths.push({ points: [point, positions.get(child)!], color: highlighted.has(child.id) ? COLORS.positive : '#64748b', width: highlighted.has(child.id) ? 4 : 1 });
            visit(child);
        }
    };
    visit(tree); return { points, paths };
}

function leafRegions(tree: TreeNode): SpatialBox[] {
    const boxes: SpatialBox[] = [];
    const visit = (node: TreeNode, min: number[], max: number[]) => {
        if (node.left && node.right && node.feature !== undefined && node.threshold !== undefined) {
            const lowerMax = [...max]; lowerMax[node.feature] = Math.min(max[node.feature], node.threshold);
            const upperMin = [...min]; upperMin[node.feature] = Math.max(min[node.feature], node.threshold);
            visit(node.left, min, lowerMax); visit(node.right, upperMin, max);
        } else boxes.push({ position: [(min[0] + max[0]) / 2, node.value, (min[1] + max[1]) / 2],
            size: [max[0] - min[0], 0.025, max[1] - min[1]], color: node.value >= 0.5 ? COLORS.positive : COLORS.negative, opacity: 0.45 });
    };
    visit(tree, [-1, -1], [1, 1]); return boxes;
}

export default function TreeLab({ mode = 'tree' }: TreeLabProps) {
    const [task, setTask] = useState<TreeTask>(mode === 'tree' || mode === 'bagging' ? 'classification' : 'regression');
    const [algorithm, setAlgorithm] = useState<BoostAlgorithm>('gradient');
    const [depth, setDepth] = useState(3); const [minLeaf, setMinLeaf] = useState(3);
    const [pruning, setPruning] = useState(0); const [rounds, setRounds] = useState(12);
    const [learningRate, setLearningRate] = useState(0.3); const [lambda, setLambda] = useState(1);
    const [gamma, setGamma] = useState(0); const [bins, setBins] = useState(8); const [maxLeaves, setMaxLeaves] = useState(8);
    const [features, setFeatures] = useState(2); const [growth, setGrowth] = useState<TreeGrowth>('depthwise');
    const [goss, setGoss] = useState(false); const [noise, setNoise] = useState(0.15); const [seed, setSeed] = useState(3610);
    const [step, setStep] = useState(mode === 'tree' ? 0 : 1); const [view, setView] = useState<View>('prediction');
    const [probeX, setProbeX] = useState(0.3); const [probeZ, setProbeZ] = useState(0.3);
    const effectiveTask = mode === 'boosting' && algorithm === 'adaboost' ? 'classification' : task;
    const train = useMemo(() => treeData(effectiveTask, 48, noise, seed), [effectiveTask, noise, seed]);
    const test = useMemo(() => treeData(effectiveTask, 160, noise, seed + 100000), [effectiveTask, noise, seed]);
    const model = useMemo(() => {
        const options = { task: effectiveTask, maxDepth: depth, minLeaf, pruning, seed, maxFeatures: features };
        return {
            tree: mode === 'tree' ? fitTree(train, options) : undefined,
            forest: mode === 'bagging' ? fitBagging(train, rounds, options) : undefined,
            boost: mode !== 'tree' && mode !== 'bagging' ? fitBoosting(train, { ...options,
                algorithm: mode === 'boosting' ? algorithm : mode, rounds, learningRate, lambda, gamma,
                bins, maxLeaves: mode === 'xgboost' || mode === 'lightgbm' ? maxLeaves : undefined, growth, goss }) : undefined,
        };
    }, [effectiveTask, depth, minLeaf, pruning, seed, features, mode, train, rounds, algorithm, learningRate, lambda, gamma, bins, maxLeaves, growth, goss]);
    const probe = useMemo(() => [probeX, probeZ], [probeX, probeZ]);
    const probePath = useMemo(() => model.tree ? treePath(model.tree, probe) : [], [model.tree, probe]);
    const maxStep = model.tree ? Math.max(0, probePath.length - 1) : model.forest?.length ?? model.boost?.rounds.length ?? 0;
    const visibleStep = Math.min(step, maxStep);
    const selectedRound = model.boost?.rounds[Math.max(0, visibleStep - 1)];
    const selectedBag = model.forest?.[Math.max(0, visibleStep - 1)];
    const selectedTree = model.tree ?? (visibleStep > 0 ? selectedBag?.tree ?? selectedRound?.tree : undefined);
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
    const closest = train.reduce((best, row, index) => Math.hypot(row.x[0] - probeX, row.x[1] - probeZ)
        < Math.hypot(train[best].x[0] - probeX, train[best].x[1] - probeZ) ? index : best, 0);
    const currentNode = model.tree ? probePath[visibleStep] : selectedTree;
    const bootstrapReplicates = useMemo(() => mode === 'bagging' && view === 'variance'
        ? Array.from({ length: 8 }, (_, index) => fitBagging(train, rounds, { task: effectiveTask, maxDepth: depth, minLeaf, maxFeatures: features, seed: seed + index * 7919 })) : [],
    [mode, view, train, rounds, effectiveTask, depth, minLeaf, features, seed]);
    const singlePredictions = useMemo(() => bootstrapReplicates.map(forest => predictTree(forest[0].tree, probe)), [bootstrapReplicates, probe]);
    const aggregatePredictions = useMemo(() => bootstrapReplicates.map(forest => visibleStep ? predictBagging(forest.slice(0, visibleStep), probe) : baseline), [bootstrapReplicates, visibleStep, probe, baseline]);
    const bundleRows = useMemo(() => train.map(row => [row.x[0] > 0.35 ? 1 : 0, row.x[0] < -0.35 ? 1 : 0]), [train]);
    const bundle = useMemo(() => bundleExclusiveIndicators(bundleRows), [bundleRows]);
    const decoded = useMemo(() => decodeExclusiveIndicators(bundle), [bundle]);

    const geometry = useMemo<SpatialSceneProps>(() => {
        if (view === 'structure' && selectedTree) {
            const highlighted = new Set((model.tree ? probePath.slice(0, visibleStep + 1) : treePath(selectedTree, probe)).map(node => node.id));
            return { ...drawTree(selectedTree, highlighted), axes: ['Branch position', 'Negative depth', 'Leaf value / correction'] as const,
                description: `${TITLES[mode]}: the actual fitted tree and the gold prediction path for the query. Internal labels give the tested feature and threshold.` };
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
            color: selectedBag && selectedBag.inBag[i] === 0 ? '#64748b'
                : selectedRound?.sampling ? selectedRound.sampling.large.includes(i) ? COLORS.positive : selectedRound.sampling.small.includes(i) ? COLORS.correction : '#64748b'
                    : effectiveTask === 'classification' ? row.y ? COLORS.positive : COLORS.negative : '#a5b4fc',
            radius: selectedBag ? 0.025 + 0.02 * Math.sqrt(selectedBag.inBag[i])
                : mode === 'boosting' && algorithm === 'adaboost' && selectedRound ? 0.025 + 0.045 * Math.sqrt(selectedRound.weights[i] * train.length) : 0.045,
            label: i === closest ? `row ${i + 1}` : undefined }));
        points.push({ position: [probeX, predict(probe), probeZ], color: COLORS.selected, radius: 0.09, label: `query ${format(predict(probe))}` });
        const residuals: SpatialPath[] = train.map((row, i) => ({ points: [[row.x[0], trainPredictions[i], row.x[1]], [row.x[0], row.y, row.x[1]]],
            color: '#64748b', width: 1 }));
        const vertices = Array.from({ length: 17 * 17 }, (_, i): LabVector => {
            const x = -1 + (i % 17) / 8; const z = -1 + Math.floor(i / 17) / 8;
            return [x, predict([x, z]), z];
        });
        return { points, paths: residuals, boxes: model.tree ? leafRegions(model.tree) : [],
            surfaces: model.tree ? [] : [{ vertices, columns: 17, color: COLORS.correction, opacity: 0.35 }],
            axes: ['Feature x₁', effectiveTask === 'classification' ? 'Class score / target' : 'Prediction / target', 'Feature x₂'] as const,
            description: `${TITLES[mode]} fitted prediction space: observed training points, the white query prediction, and residual lines. ${model.tree ? 'Each flat region is an exact leaf prediction.' : 'The mesh interpolates a 17 by 17 grid of actual predictions; tree boundaries can lie between samples.'}` };
    }, [view, selectedTree, model, probePath, visibleStep, probe, mode, singlePredictions, aggregatePredictions, bundle, bundleRows,
        train, effectiveTask, selectedBag, algorithm, selectedRound, closest, probeX, probeZ, predict, trainPredictions]);

    const viewOptions = [{ value: 'prediction', label: 'Prediction space' }, { value: 'structure', label: 'Fitted tree & query path' },
        ...(mode === 'bagging' ? [{ value: 'variance', label: 'Bootstrap prediction variance' }] : []),
        ...(mode !== 'tree' && mode !== 'bagging' ? [{ value: 'loss', label: 'Actual training loss by round' }] : []),
        ...(mode === 'lightgbm' ? [{ value: 'bundle', label: 'Exclusive feature packing experiment' }] : [])];
    const controls = <>
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
        {mode === 'bagging' && <LabSelect label="Features considered at each split" value={String(features)} options={[{ value: '2', label: 'Both features: bagging' }, { value: '1', label: 'One random feature: random forest' }]} onChange={value => setFeatures(Number(value))} />}
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
        <LabPlayback step={visibleStep} max={maxStep} onStep={setStep} />
        <button type="button" className="lab-button" onClick={() => { setSeed(current => current + 1); setStep(mode === 'tree' ? 0 : 1); }}>Resample data</button>
    </>;
    let insight = mode === 'tree' ? view === 'structure'
        ? `Query path: step ${visibleStep}, ${currentNode?.feature === undefined ? 'leaf predicts' : `test x${currentNode.feature + 1} ≤ ${currentNode.threshold?.toFixed(2)}; node value`} ${format(currentNode?.value ?? 0)}. Gold highlights the decisions taken.`
        : `Each flat region is one leaf's prediction; the white marker is the query. Move its feature sliders, then choose the fitted-tree view and Step to follow the threshold decisions.`
        : mode === 'bagging' ? `${visibleStep} bootstrap trees averaged. Closest training row ${closest + 1} occurs ${selectedBag?.inBag[closest] ?? 0} times in the selected bootstrap; gray points are out of bag.`
            : `${visibleStep} actual additive updates. Selected correction at query: ${format(selectedTree ? predictTree(selectedTree, probe) : 0)}; learning multiplier: ${format(selectedRound?.alpha ?? learningRate)}.`;
    if (view === 'variance') insight = `Eight independent bootstrap fits: single-tree variance ${format(variance(singlePredictions))}, ensemble variance ${format(variance(aggregatePredictions))}. Variation is conditional on this original dataset; reduction is not guaranteed for every finite sample.`;
    if (view === 'bundle') insight = `Two exclusive binary indicators are stored as one code (0 neither, 1 first, 2 second). ${decoded.filter((row, i) => row.every((value, j) => value === bundleRows[i][j])).length}/48 rows decode exactly. This packing experiment does not bundle the dense training features.`;
    if ((mode === 'xgboost' || mode === 'lightgbm') && view === 'structure' && currentNode) insight += ` Root statistics: G=${format(currentNode.gradient ?? 0)}, H=${format(currentNode.hessian ?? 0)}; w=−G/(H+λ)=${format(currentNode.value)}; split gain=${format(currentNode.gain ?? 0)}.`;
    if (mode === 'lightgbm' && selectedRound?.sampling) insight += ` GOSS retained ${selectedRound.sampling.kept.length}/48 rows: gold large-gradient, teal sampled small-gradient, gray omitted. Sampled small-gradient rows carry weight ${format(selectedRound.sampling.correction)}.`;
    if (mode === 'boosting' && algorithm === 'adaboost') insight += ' Marker sizes show actual pre-round example weights; misclassified examples receive more relative weight. AdaBoost scores are not calibrated probabilities.';

    const explanation = <SceneExplanation title={TITLES[mode]} summary="The displayed models are fitted numerically to 48 synthetic training rows; 160 independent rows measure held-out performance.">
        <ExplanationSection title="Read and manipulate the space"><p>The prediction view uses feature x₁ horizontally, target or class score vertically, and feature x₂ in depth. Colored observations are training data; vertical lines connect their observed targets to predictions. Move the two query sliders and inspect its white marker. Switch to the tree view to follow exact threshold decisions. The ensemble mesh is a sampled surface, so its interpolation is not an exact boundary drawing.</p></ExplanationSection>
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
    return <VisualLab title={TITLES[mode]} subtitle="Fit small real trees, inspect their decisions, and compare held-out predictions." controls={controls}
        metrics={metrics} insight={insight} explanation={explanation} challenge={mode === 'tree' ? 'Increase depth, then increase pruning. Compare the number of leaves and held-out error.'
            : mode === 'bagging' ? 'Choose one random feature at each split, switch to bootstrap variance, and step through ensemble size.'
                : mode === 'lightgbm' ? 'Reduce histogram bins, toggle GOSS, then inspect the tree gain and held-out score.' : 'Step through added trees, then compare learning rates on the actual loss trace.'}>
        <SpatialScene {...geometry} />
    </VisualLab>;
}
