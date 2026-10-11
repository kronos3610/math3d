import { VIZ } from '../../data/palette';
import { useMemo, useState } from 'react';
import { VisualLab, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { SpatialScene } from '../../components/3d/SpatialScene';
import type { LabVector, SpatialPath, SpatialPoint, SpatialSurface, SpatialVector } from '../../components/3d/SpatialScene';
import { fitSVM, fitSVR, svmFeaturePoint, svmPrediction, svmRawLinearPlane } from '../../utils/ml-svm';
import type { SVMCoordinate, SVMKernel, SVMObservation, SVRObservation } from '../../utils/ml-svm';
import { sampleNormal, seededRandom } from '../../utils/regression';

export type SVMLabMode = 'margin' | 'kernel' | 'regression';
interface SVMLabProps { mode?: SVMLabMode; }
type Pattern = 'linear' | 'rings' | 'xor';
const TITLES: Record<SVMLabMode, string> = { margin: 'Support Vectors & Margins', kernel: 'Kernel SVM', regression: 'Support Vector Regression' };
const format = (value: number) => Number.isFinite(value) ? Math.abs(value) < 0.0001 && value !== 0 ? value.toExponential(1) : value.toFixed(3) : '∞';

function generateClassification(size: number, seed: number, pattern: Pattern, labelNoise: number, useDepth: boolean): SVMObservation[] {
    const random = seededRandom(seed);
    return Array.from({ length: size }, () => {
        const angle = random() * 2 * Math.PI; const radius = 0.15 + random();
        const x: SVMCoordinate = pattern === 'rings' ? [radius * Math.cos(angle), radius * Math.sin(angle), 0]
            : [2 * random() - 1, 2 * random() - 1, useDepth ? 2 * random() - 1 : 0];
        let label: -1 | 1 = (pattern === 'rings' ? radius - 0.65 : pattern === 'xor' ? x[0] * x[1] : x[0] + 0.6 * x[1] - 0.4 * x[2]) >= 0 ? 1 : -1;
        if (random() < labelNoise) label = label === 1 ? -1 : 1;
        return { x, label };
    });
}

function generateRegression(size: number, seed: number, noise: number): SVRObservation[] {
    const random = seededRandom(seed);
    return Array.from({ length: size }, () => {
        const x: SVMCoordinate = [2 * random() - 1, 2 * random() - 1, 0];
        return { x, y: 0.3 + 1.1 * x[0] - 0.7 * x[1] + 0.5 * Math.sin(3 * x[0]) + noise * sampleNormal(random) };
    });
}

/** A true plane w·x+b=level in the displayed feature space. */
function marginPlane(weights: SVMCoordinate, bias: number, level: number, color: string, opacity: number): SpatialSurface | null {
    const norm = Math.hypot(...weights);
    if (norm < 1e-8) return null;
    const n = weights.map(value => value / norm) as LabVector;
    const seed: LabVector = Math.abs(n[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    const cross = (a: LabVector, b: LabVector): LabVector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const first = cross(n, seed); const length = Math.hypot(...first);
    const u = first.map(value => value / length) as LabVector; const v = cross(n, u);
    const origin = n.map(value => value * (level - bias) / norm) as LabVector;
    const vertices: LabVector[] = [];
    for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) vertices.push(origin.map((value, axis) => value + u[axis] * (-1.7 + column * 0.85) + v[axis] * (-1.7 + row * 0.85)) as LabVector);
    return { vertices, columns: 5, color, opacity };
}

export default function SVMLab({ mode = 'margin' }: SVMLabProps) {
    const [kernel, setKernel] = useState<SVMKernel>(mode === 'kernel' ? 'lift' : mode === 'regression' ? 'rbf' : 'linear');
    const [pattern, setPattern] = useState<Pattern>(mode === 'kernel' ? 'rings' : 'linear');
    const [C, setC] = useState(mode === 'regression' ? 4 : 2);
    const [gamma, setGamma] = useState(1.5);
    const [epsilon, setEpsilon] = useState(0.15);
    const [scale, setScale] = useState(false);
    const [noise, setNoise] = useState(mode === 'regression' ? 0.12 : 0);
    const [sampleSize, setSampleSize] = useState(36);
    const [seed, setSeed] = useState(419);
    const [selected, setSelected] = useState(0);
    const [edits, setEdits] = useState<Record<number, { x?: SVMCoordinate; label?: -1 | 1; y?: number }>>({});
    const baseClass = useMemo(() => generateClassification(sampleSize, seed, pattern, noise, mode === 'margin'), [sampleSize, seed, pattern, noise, mode]);
    const baseRegression = useMemo(() => generateRegression(sampleSize, seed, noise), [sampleSize, seed, noise]);
    const classification = useMemo(() => baseClass.map((sample, index) => ({ x: edits[index]?.x ?? sample.x, label: edits[index]?.label ?? sample.label })), [baseClass, edits]);
    const regression = useMemo(() => baseRegression.map((sample, index) => ({ x: edits[index]?.x ?? sample.x, y: edits[index]?.y ?? sample.y })), [baseRegression, edits]);
    const model = useMemo(() => mode === 'regression' ? fitSVR(regression, { C, kernel, gamma, scale, epsilon }) : fitSVM(classification, { C, kernel, gamma, scale }), [mode, regression, classification, C, kernel, gamma, scale, epsilon]);
    const testClassification = useMemo(() => generateClassification(120, seed + 100003, pattern, noise, mode === 'margin'), [seed, pattern, noise, mode]);
    const testRegression = useMemo(() => generateRegression(120, seed + 100003, noise), [seed, noise]);
    const selectedIndex = Math.min(selected, sampleSize - 1);
    const selectedPoint = mode === 'regression' ? regression[selectedIndex].x : classification[selectedIndex].x;
    const support = useMemo(() => new Set(model.supportIndices), [model.supportIndices]);
    const trainingAccuracy = classification.reduce((sum, sample) => sum + Number(sample.label * svmPrediction(model, sample.x) > 0), 0) / classification.length;
    const testAccuracy = testClassification.reduce((sum, sample) => sum + Number(sample.label * svmPrediction(model, sample.x) > 0), 0) / testClassification.length;
    const trainingMSE = regression.reduce((sum, sample) => sum + (sample.y - svmPrediction(model, sample.x)) ** 2, 0) / regression.length;
    const testMSE = testRegression.reduce((sum, sample) => sum + (sample.y - svmPrediction(model, sample.x)) ** 2, 0) / testRegression.length;
    const spatial = useMemo(() => {
        const points: SpatialPoint[] = [];
        const surfaces: SpatialSurface[] = [];
        const paths: SpatialPath[] = [];
        const vectors: SpatialVector[] = [];
        if (mode === 'regression' || mode === 'kernel' && kernel !== 'lift') {
            const grid: LabVector[] = []; const lower: LabVector[] = []; const upper: LabVector[] = [];
            for (let row = 0; row < 19; row++) for (let column = 0; column < 19; column++) {
                const x1 = -1.25 + column * 2.5 / 18; const x2 = -1.25 + row * 2.5 / 18;
                const value = svmPrediction(model, [x1, x2, 0]);
                grid.push([x1, value, x2]); lower.push([x1, mode === 'regression' ? value - epsilon : 0, x2]); upper.push([x1, mode === 'regression' ? value + epsilon : 1, x2]);
            }
            surfaces.push({ vertices: grid, columns: 19, color: VIZ.truth, opacity: 0.4 }, { vertices: lower, columns: 19, color: VIZ.focus, opacity: 0.14 });
            if (mode === 'regression') surfaces.push({ vertices: upper, columns: 19, color: VIZ.focus, opacity: 0.14 });
            if (mode === 'regression') regression.forEach((sample, index) => {
                points.push({ position: [sample.x[0], sample.y, sample.x[1]], color: support.has(index) ? VIZ.focus : VIZ.data, radius: index === selectedIndex ? 0.13 : support.has(index) ? 0.09 : 0.06, label: index === selectedIndex ? 'Selected observation' : undefined });
                const prediction = svmPrediction(model, sample.x);
                if (index < 10 && Math.abs(sample.y - prediction) > epsilon) paths.push({ points: [[sample.x[0], prediction + Math.sign(sample.y - prediction) * epsilon, sample.x[1]], [sample.x[0], sample.y, sample.x[1]]], color: VIZ.error, width: 1.5 });
            });
            else classification.forEach((sample, index) => points.push({ position: [sample.x[0], svmPrediction(model, sample.x), sample.x[1]], color: sample.label > 0 ? VIZ.data : VIZ.error, radius: index === selectedIndex ? 0.13 : support.has(index) ? 0.11 : 0.06, label: index === selectedIndex ? `Selected class ${sample.label > 0 ? '+1' : '−1'}` : undefined }));
        } else {
            const plane = kernel === 'lift' ? model.featureWeights ? { weights: model.featureWeights, bias: model.bias } : null : svmRawLinearPlane(model);
            if (plane) {
                for (const level of [-1, 0, 1]) {
                    const surface = marginPlane(plane.weights, plane.bias, level, level === 0 ? VIZ.truth : VIZ.focus, level === 0 ? 0.25 : 0.12);
                    if (surface) surfaces.push(surface);
                }
                const length = Math.hypot(...plane.weights);
                if (length > 1e-8) vectors.push({ from: [0, 0, 0], to: plane.weights.map(value => value / length) as LabVector, color: VIZ.truth, label: 'Plane normal' });
            }
            classification.forEach((sample, index) => points.push({ position: kernel === 'lift' ? svmFeaturePoint(model, sample.x) : sample.x, color: sample.label > 0 ? VIZ.data : VIZ.error, radius: index === selectedIndex ? 0.13 : support.has(index) ? 0.11 : 0.06, label: index === selectedIndex ? `Selected class ${sample.label > 0 ? '+1' : '−1'}` : undefined }));
        }
        return { points, surfaces, paths, vectors };
    }, [mode, kernel, model, epsilon, regression, classification, selectedIndex, support]);
    const editCoordinate = (axis: number, value: number) => {
        const x: SVMCoordinate = [...selectedPoint]; x[axis] = value;
        setEdits(current => ({ ...current, [selectedIndex]: { ...current[selectedIndex], x } }));
    };
    const controls = <>
        {mode !== 'margin' && <LabSelect label="Kernel" value={kernel} options={mode === 'regression' ? [{ value: 'linear', label: 'Linear' }, { value: 'rbf', label: 'RBF' }] : [{ value: 'linear', label: 'Linear' }, { value: 'lift', label: 'Exact finite lift: (x₁,x₂,x₁²+x₂²)' }, { value: 'rbf', label: 'RBF · implicit feature space' }]} onChange={value => setKernel(value as SVMKernel)} />}
        {mode === 'kernel' && <LabSelect label="Classification pattern" value={pattern} options={[{ value: 'rings', label: 'Concentric operating regions' }, { value: 'linear', label: 'Linear separation' }, { value: 'xor', label: 'XOR · feature-map limitations' }]} onChange={value => { setPattern(value as Pattern); setEdits({}); }} />}
        <LabRange label="Violation penalty C" value={C} min={0.05} max={20} step={0.05} decimals={2} onChange={setC} />
        {kernel === 'rbf' && <LabRange label="RBF locality γ" value={gamma} min={0.05} max={5} step={0.05} decimals={2} onChange={setGamma} />}
        {mode === 'regression' && <LabRange label="Insensitive tube ε" value={epsilon} min={0} max={0.8} step={0.025} decimals={3} onChange={setEpsilon} />}
        <LabSelect label="Feature scaling" value={scale ? 'standard' : 'raw'} options={[{ value: 'raw', label: 'Raw coordinates' }, { value: 'standard', label: 'Training-set standardization' }]} onChange={value => setScale(value === 'standard')} />
        <LabRange label={mode === 'regression' ? 'Response noise σ' : 'Label flip probability'} value={noise} min={0} max={0.3} step={0.02} decimals={2} onChange={value => { setNoise(value); setEdits({}); }} />
        <LabRange label="Training observations" value={sampleSize} min={12} max={56} step={4} onChange={value => { setSampleSize(value); setEdits({}); }} />
        <LabSelect label="Selected observation" value={String(selectedIndex)} options={Array.from({ length: sampleSize }, (_, index) => ({ value: String(index), label: `Observation ${index + 1}` }))} onChange={value => setSelected(Number(value))} />
        <LabRange label="Selected input x₁" value={selectedPoint[0]} min={-1.5} max={1.5} step={0.05} decimals={2} onChange={value => editCoordinate(0, value)} />
        <LabRange label="Selected input x₂" value={selectedPoint[1]} min={-1.5} max={1.5} step={0.05} decimals={2} onChange={value => editCoordinate(1, value)} />
        {mode === 'margin' && <LabRange label="Selected input x₃" value={selectedPoint[2]} min={-1.5} max={1.5} step={0.05} decimals={2} onChange={value => editCoordinate(2, value)} />}
        {mode === 'regression' ? <LabRange label="Selected observed response" value={regression[selectedIndex].y} min={-4} max={5} step={0.05} decimals={2} onChange={value => setEdits(current => ({ ...current, [selectedIndex]: { ...current[selectedIndex], y: value } }))} />
            : <LabSelect label="Selected class" value={String(classification[selectedIndex].label)} options={[{ value: '-1', label: '−1 · red' }, { value: '1', label: '+1 · blue' }]} onChange={value => setEdits(current => ({ ...current, [selectedIndex]: { ...current[selectedIndex], label: Number(value) as -1 | 1 } }))} />}
        <button type="button" className="lab-button" onClick={() => { setSeed(current => current + 1); setEdits({}); }}>Resample observations</button>
    </>;
    const explanation = <div className="lab-explanation"><h2>{TITLES[mode]}</h2>
        <p>{mode === 'regression' ? 'SVR predicts a numeric response. Its ε tube ignores small response errors and penalizes excess errors, balancing them against the model norm.' : 'An SVM uses a signed score to separate classes. Larger points identify support vectors; those points have nonzero dual weights and determine the fitted separator.'}</p>
        <h3>Actual optimization</h3><p>The teaching engine performs exact feasible pair-coordinate updates on the convex dual. It checks KKT residuals and reports its iteration budget honestly. C weights violations; a larger C penalizes them more. With separable data and inactive upper dual bounds, the soft-margin solution coincides with the hard-margin optimum.</p>
        <p>In the margin and finite-lift views, the displayed planes are score = −1, 0, +1 in a genuine three-dimensional input space or the explicit finite feature space. In the kernel score-height view, the teal surface shows f(x) and the gold horizontal plane is the zero decision threshold. Feature scaling changes the optimization metric, so it must use training statistics and be applied to new points consistently.</p>
        <h3>Feature maps and kernels</h3><p>The finite map is exactly φ(x) = (x₁, x₂, x₁² + x₂²), with dot-product kernel φ(x)·φ(x′). It can separate concentric regions, but it is not the complete quadratic polynomial kernel and cannot express every nonlinear boundary.</p>
        <p>The RBF kernel is exp(−γ‖x−x′‖²). Its feature representation is implicit and not three-dimensional. In the RBF view the vertical axis is the computed decision score, not a hidden feature axis. A score is not a calibrated class probability.</p>
        <h3>Use and assumptions</h3><p>Margins rely on useful features and an appropriate geometry, not Gaussian input distributions. These synthetic operating-region examples illustrate classification; the numeric-response mode illustrates nonlinear tabular regression. Training data and independent test data share the selected simulation; editing training points creates custom examples.</p>
        <p>The ε-SVR solver optimizes ½‖w‖² + CΣmax(0, |y−f(x)|−ε). A sample inside the tube can have zero support weight. The shown upper and lower surfaces are f(x)±ε, measured in response units.</p>
    </div>;
    const dualGap = Math.max(0, model.primalObjective - model.dualObjective);
    const axes: [string, string, string] = mode === 'regression' ? ['Input x₁', 'Response y', 'Input x₂'] : mode === 'kernel' && kernel === 'lift' ? [scale ? 'Standardized x₁' : 'Input x₁', scale ? 'Standardized x₂' : 'Input x₂', 'φ₃ = x₁² + x₂²'] : mode === 'kernel' ? ['Input x₁', 'Decision score f(x)', 'Input x₂'] : ['Input x₁', 'Input x₂', 'Input x₃'];
    return <VisualLab title={TITLES[mode]} subtitle={mode === 'regression' ? 'A computed prediction surface and a response-error tube.' : 'Move observations and see the actual trained separating geometry.'}
        controls={controls} metrics={[{ label: 'Support vectors', value: `${model.supportIndices.length}/${sampleSize}` },
            { label: mode === 'regression' ? 'Training MSE' : 'Training accuracy', value: mode === 'regression' ? format(trainingMSE) : `${(100 * trainingAccuracy).toFixed(1)}%` },
            { label: mode === 'regression' ? 'Independent test MSE' : 'Independent test accuracy', value: mode === 'regression' ? format(testMSE) : `${(100 * testAccuracy).toFixed(1)}%` },
            { label: 'KKT residual', value: format(model.kktResidual) }, { label: 'Primal–dual gap', value: format(dualGap) }]}
        insight={<>{model.converged ? 'The dual solver meets its KKT tolerance.' : 'The solver reached its iteration budget; residual optimization error is reported above.'} {mode === 'regression' ? `Gold support observations influence the ε=${epsilon.toFixed(3)} tube. Errors inside it are ignored by the loss.` : mode === 'kernel' && kernel !== 'lift' ? 'The vertical axis is a decision score. Teal shows f(x); the gold zero plane is the decision threshold. Large points are support vectors.' : 'Green marks score zero; gold marks score ±1. Large points are support vectors.'}</>}
        explanation={explanation} challenge={mode === 'regression' ? 'Increase ε and inspect which observations stop being support vectors. Compare RBF with a linear prediction surface.' : mode === 'kernel' ? 'Compare the finite lift with RBF on rings, then XOR. A feature map cannot solve patterns it cannot represent.' : 'Flip a nearby point’s class, then vary C. Compare margin violations, support vectors, and independent test accuracy.'}>
        <SpatialScene {...spatial} equalScale axes={axes} description={`${TITLES[mode]} with actual ${kernel} fitted predictions, support vectors, and labeled feature or response axes. Edit observations using the selected-input controls.`} />
    </VisualLab>;
}
