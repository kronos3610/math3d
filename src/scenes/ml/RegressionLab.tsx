import { useMemo, useState } from 'react';
import { VisualLab, LabPlayback, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { SpatialScene } from '../../components/3d/SpatialScene';
import type { LabVector, SpatialPath, SpatialPoint, SpatialSurface, SpatialVector } from '../../components/3d/SpatialScene';
import { fitMLRegression, generateRegressionData, projectThreeObservations, regressionFeatures, regressionLoss, regressionMSE, regressionPrediction, residualLagCorrelation } from '../../utils/ml-regression';
import type { RegressionBasis, RegressionObservation, RegressionPreset, RegressionSolver, ResponseVector } from '../../utils/ml-regression';

export type RegressionLabMode = 'fit' | 'solvers' | 'assumptions' | 'features';
interface RegressionLabProps { mode?: RegressionLabMode; }
const TITLES: Record<RegressionLabMode, string> = { fit: 'Linear Regression', solvers: 'Least-Squares Solvers', assumptions: 'Regression Assumptions', features: 'Features, Weights & Ridge' };
const PRESETS = [
    { value: 'linear', label: 'Linear mean · independent noise' }, { value: 'curved', label: 'Curved mean · misspecified plane' },
    { value: 'heteroskedastic', label: 'Heteroskedastic noise' }, { value: 'correlated-errors', label: 'Correlated errors in observation order' },
    { value: 'non-gaussian', label: 'Non-Gaussian · uniform response errors' },
    { value: 'collinear', label: 'Exactly collinear inputs' }, { value: 'outlier', label: 'One contaminated training response' },
    { value: 'confounded', label: 'Hidden common cause' },
] as const;
const NOTES: Record<RegressionPreset, string> = {
    linear: 'The plane models the conditional mean; response errors are vertical gaps, not perpendicular distances to the plane.',
    curved: 'A plane cannot follow this curved mean. Add quadratic features to change the model family; switching solvers cannot fix misspecification.',
    heteroskedastic: 'The error spread changes with area. OLS can still estimate a zero-mean-error model; conventional constant-variance standard errors would be inappropriate.',
    'correlated-errors': 'Errors share information across observation order. Inspect residuals by order; fitting a plane does not justify treating observations as independent for inference.',
    'non-gaussian': 'Uniform errors have zero mean and variance σ². Least squares still fits a valid linear conditional mean; Gaussianity is not a requirement for minimizing squared error.',
    collinear: 'Distance equals area. Their separate coefficients are unidentified; SVD selects a minimum-norm solution, while predictions can remain well defined.',
    outlier: 'One training price is contaminated. Squaring its residual gives it large influence; the independent test set remains uncontaminated.',
    confounded: 'The hidden factor affects both area and price. A predictive area coefficient does not identify the structural area effect, which is 1.2 in this known simulation.',
};
const fmt = (value: number) => Number.isFinite(value) ? Math.abs(value) > 1e4 ? value.toExponential(2) : (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3) : '∞';

export default function RegressionLab({ mode = 'fit' }: RegressionLabProps) {
    const [preset, setPreset] = useState<RegressionPreset>(mode === 'features' ? 'curved' : 'linear');
    const [basis, setBasis] = useState<RegressionBasis>('linear');
    const [solver, setSolver] = useState<RegressionSolver>(mode === 'solvers' ? 'gd' : 'qr');
    const [noise, setNoise] = useState(0.2);
    const [sampleSize, setSampleSize] = useState(48);
    const [correlation, setCorrelation] = useState(0);
    const [ridge, setRidge] = useState(0);
    const [weighted, setWeighted] = useState(false);
    const [learningRate, setLearningRate] = useState(0.6);
    const [seed, setSeed] = useState(73);
    const [step, setStep] = useState(0);
    const [selected, setSelected] = useState(0);
    const [edits, setEdits] = useState<Record<number, Partial<RegressionObservation>>>({});
    const [display, setDisplay] = useState<'fit' | 'residuals'>('fit');
    const [showHidden, setShowHidden] = useState(false);
    const [coefficientSource, setCoefficientSource] = useState<'fit' | 'manual'>('fit');
    const [manualCoefficients, setManualCoefficients] = useState<ResponseVector>([0, 0, 0]);
    const [batchSize, setBatchSize] = useState(8);
    const [solverGeometry, setSolverGeometry] = useState<'objective' | 'projection'>('objective');
    const [projectionResponses, setProjectionResponses] = useState<ResponseVector>([-0.5, 0.8, 1.4]);
    const projection = useMemo(() => projectThreeObservations([-1, 0, 1], projectionResponses), [projectionResponses]);
    const isProjection = mode === 'solvers' && solverGeometry === 'projection';
    const generated = useMemo(() => generateRegressionData({ preset, sampleSize, noiseStd: noise, correlation, seed }), [preset, sampleSize, noise, correlation, seed]);
    const samples = useMemo(() => generated.map((sample, index) => ({ ...sample, ...edits[index], weight: weighted ? 1 / Math.max(1e-8, (sample.noiseStd ?? noise) ** 2) : 1 })), [generated, edits, weighted, noise]);
    const testSamples = useMemo(() => generateRegressionData({ preset: preset === 'outlier' ? 'linear' : preset, sampleSize: 160, noiseStd: noise, correlation, seed: seed + 100003 }), [preset, noise, correlation, seed]);
    const fit = useMemo(() => fitMLRegression(samples, { basis, solver, ridge, learningRate, batchSize, iterations: solver === 'sgd' || solver === 'minibatch' ? 240 : 120, seed }), [samples, basis, solver, ridge, learningRate, batchSize, seed]);
    const reference = useMemo(() => fitMLRegression(samples, { basis, solver: 'svd', ridge }), [samples, basis, ridge]);
    const currentStep = Math.min(step, fit.trace.length - 1);
    const coefficients = mode === 'solvers' ? fit.trace[currentStep].coefficients : mode === 'fit' && coefficientSource === 'manual' ? manualCoefficients : fit.coefficients;
    const selectedIndex = Math.min(selected, samples.length - 1);
    const observation = samples[selectedIndex];
    const trainMSE = regressionMSE(samples, coefficients, basis);
    const testMSE = regressionMSE(testSamples, coefficients, basis);
    const dimensions = regressionFeatures(0, 0, basis).length;
    const spatial = useMemo(() => {
        if (isProjection) {
            const u: LabVector = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
            const v: LabVector = [-1 / Math.sqrt(2), 0, 1 / Math.sqrt(2)];
            const extent = 1.15 * Math.max(2, Math.abs(projection.fitted.reduce((sum, value, axis) => sum + value * u[axis], 0)), Math.abs(projection.fitted.reduce((sum, value, axis) => sum + value * v[axis], 0)));
            const vertices: LabVector[] = [];
            for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) vertices.push(u.map((value, axis) => value * (-extent + column * extent / 2) + v[axis] * (-extent + row * extent / 2)) as LabVector);
            const vectors: SpatialVector[] = [
                { from: [0, 0, 0], to: projection.interceptColumn, color: '#fbbf24', label: '1 column' },
                { from: [0, 0, 0], to: projection.featureColumn, color: '#c084fc', label: 'x column' },
                { from: [0, 0, 0], to: projection.response, color: '#60a5fa', label: 'y' },
                { from: [0, 0, 0], to: projection.fitted, color: '#2dd4bf', label: 'ŷ' },
                { from: projection.fitted, to: projection.response, color: '#fb7185', label: 'Residual' },
            ];
            const points: SpatialPoint[] = [{ position: projection.response, color: '#60a5fa', radius: 0.09 }, { position: projection.fitted, color: '#2dd4bf', radius: 0.09 }];
            return { points, paths: [], vectors, surfaces: [{ vertices, columns: 5, color: '#2dd4bf', opacity: 0.18 }] };
        }
        const points: SpatialPoint[] = samples.map((sample, index) => ({
            position: display === 'residuals' ? [preset === 'correlated-errors' ? index / 10 : sample.x1, sample.y - regressionPrediction(coefficients, sample.x1, sample.x2, basis), sample.x2] : [sample.x1, sample.y, sample.x2],
            color: index === selectedIndex ? '#fbbf24' : showHidden && preset === 'confounded' ? (sample.hidden ?? 0) > 0 ? '#fb7185' : '#60a5fa' : '#60a5fa',
            radius: index === selectedIndex ? 0.13 : 0.07, label: index === selectedIndex ? `Observation ${index + 1}` : undefined,
        }));
        const paths: SpatialPath[] = [];
        const surfaces: SpatialSurface[] = [];
        const grid: LabVector[] = [];
        if (mode === 'solvers') {
            const mean = (slope1: number, slope2: number) => samples.reduce((sum, sample) => sum + (sample.weight ?? 1) * (sample.y - slope1 * sample.x1 - slope2 * sample.x2), 0) / samples.reduce((sum, sample) => sum + (sample.weight ?? 1), 0);
            for (let row = 0; row < 19; row++) for (let column = 0; column < 19; column++) {
                const slope1 = -2 + column * 4 / 18; const slope2 = -2 + row * 4 / 18;
                grid.push([slope1, regressionLoss(samples, [mean(slope1, slope2), slope1, slope2], 'linear', ridge), slope2]);
            }
            surfaces.push({ vertices: grid, columns: 19, color: '#2dd4bf', opacity: 0.24 });
            const trace = fit.trace.slice(0, currentStep + 1).map(frame => [frame.coefficients[1], frame.loss, frame.coefficients[2]] as LabVector);
            paths.push({ points: trace, color: '#fbbf24', width: 3 });
            const solverPoints: SpatialPoint[] = [{ position: trace[trace.length - 1], color: '#fbbf24', radius: 0.12, label: 'Current coefficients' },
                { position: [reference.coefficients[1], regressionLoss(samples, reference.coefficients, 'linear', ridge), reference.coefficients[2]], color: '#f8fafc', radius: 0.1, label: 'Direct optimum' }];
            return { points: solverPoints, paths, surfaces };
        }
        for (let row = 0; row < 17; row++) for (let column = 0; column < 17; column++) {
            const x1 = -1.5 + column * 3 / 16; const x2 = -1.5 + row * 3 / 16;
            grid.push([x1, display === 'residuals' ? 0 : regressionPrediction(coefficients, x1, x2, basis), x2]);
        }
        if (display === 'fit' || preset !== 'correlated-errors') surfaces.push({ vertices: grid, columns: 17, color: '#2dd4bf', opacity: 0.35 });
        if (display === 'fit') samples.forEach((sample, index) => {
            if (index >= 10 && index !== selectedIndex) return;
            paths.push({ points: [[sample.x1, regressionPrediction(coefficients, sample.x1, sample.x2, basis), sample.x2], [sample.x1, sample.y, sample.x2]], color: index === selectedIndex ? '#fbbf24' : '#94a3b8', width: 1.5 });
        });
        else if (preset === 'correlated-errors') paths.push({ points: points.map(point => point.position), color: '#94a3b8', width: 1 });
        return { points, paths, surfaces };
    }, [samples, coefficients, basis, selectedIndex, display, preset, showHidden, mode, fit.trace, currentStep, reference.coefficients, ridge, isProjection, projection]);
    const changePreset = (value: string) => { setPreset(value as RegressionPreset); setEdits({}); setStep(0); };
    const edit = (field: 'x1' | 'x2' | 'y', value: number) => { setEdits(current => ({ ...current, [selectedIndex]: { ...current[selectedIndex], [field]: value } })); setStep(0); };
    const controls = <>
        {mode === 'solvers' && <LabSelect label="Solver geometry" value={solverGeometry} options={[{ value: 'objective', label: 'Coefficient objective' }, { value: 'projection', label: 'Three-observation projection' }]} onChange={value => setSolverGeometry(value as 'objective' | 'projection')} />}
        {isProjection ? <>
            {projectionResponses.map((response, index) => <LabRange key={index} label={`Projection response y${index + 1}`} value={response} min={-3} max={3} step={0.05} decimals={2} onChange={value => setProjectionResponses(current => current.map((item, axis) => axis === index ? value : item) as ResponseVector)} />)}
            <button type="button" className="lab-button" onClick={() => setProjectionResponses([-0.5, 0.8, 1.4])}>Reset projection responses</button>
        </> : <>
        <LabSelect label="Data-generating scenario" value={preset} options={PRESETS} onChange={changePreset} />
        <LabRange label="Observation noise σ" value={noise} min={0} max={0.8} step={0.05} decimals={2} onChange={value => { setNoise(value); setEdits({}); setStep(0); }} />
        <LabRange label="Training observations" value={sampleSize} min={12} max={80} step={4} onChange={value => { setSampleSize(value); setEdits({}); setStep(0); }} />
        {mode === 'fit' && <LabSelect label="Coefficient source" value={coefficientSource} options={[{ value: 'fit', label: 'Fitted coefficients' }, { value: 'manual', label: 'Manual coefficients' }]} onChange={value => { setCoefficientSource(value as 'fit' | 'manual'); if (value === 'manual') setManualCoefficients([...fit.coefficients] as ResponseVector); }} />}
        {(mode === 'fit' && coefficientSource === 'fit' || mode === 'solvers') && <LabSelect label="Least-squares solver" value={solver} options={[
            { value: 'qr', label: 'QR · direct' }, { value: 'svd', label: 'SVD · minimum norm' }, { value: 'gd', label: 'Gradient descent' },
            { value: 'sgd', label: 'Stochastic gradient descent' }, { value: 'minibatch', label: 'Mini-batch gradient descent' }, { value: 'newton', label: 'Newton · quadratic SVD solve' },
        ]} onChange={value => { setSolver(value as RegressionSolver); setStep(0); }} />}
        {(mode === 'fit' || mode === 'solvers') && solver === 'minibatch' && coefficientSource === 'fit' && <LabRange label="Mini-batch observations" value={Math.min(batchSize, sampleSize)} min={1} max={sampleSize} onChange={value => { setBatchSize(value); setStep(0); }} />}
        {mode === 'fit' && coefficientSource === 'manual' && <>
            {(['Manual intercept b', 'Manual area coefficient β₁', 'Manual distance coefficient β₂'] as const).map((label, index) => <LabRange key={label} label={label} value={manualCoefficients[index]} min={Math.min(-3, Math.floor(manualCoefficients[index]) - 1)} max={Math.max(3, Math.ceil(manualCoefficients[index]) + 1)} step={0.05} decimals={2} onChange={value => setManualCoefficients(current => current.map((item, axis) => axis === index ? value : item) as ResponseVector)} />)}
            <button type="button" className="lab-button" onClick={() => setManualCoefficients([...fit.coefficients] as ResponseVector)}>Copy fitted coefficients</button>
        </>}
        {mode === 'features' && <LabSelect label="Feature basis" value={basis} options={[{ value: 'linear', label: '1, x₁, x₂' }, { value: 'interaction', label: 'Add x₁x₂ interaction' }, { value: 'quadratic', label: 'Full quadratic features' }]} onChange={value => setBasis(value as RegressionBasis)} />}
        {(mode === 'features' || mode === 'solvers') && <LabRange label="Ridge strength λ" value={ridge} min={0} max={2} step={0.05} decimals={2} onChange={value => { setRidge(value); setStep(0); }} />}
        {mode === 'solvers' && <><LabRange label="Learning rate" value={learningRate} min={0.05} max={2} step={0.05} decimals={2} onChange={value => { setLearningRate(value); setStep(0); }} />
            <LabPlayback step={currentStep} max={fit.trace.length - 1} onStep={setStep} interval={200} />
            <LabRange label="Solver step" value={currentStep} min={0} max={fit.trace.length - 1} onChange={setStep} /></>}
        {mode !== 'solvers' && <><LabSelect label="Spatial view" value={display} options={[{ value: 'fit', label: 'Observations and fitted surface' }, { value: 'residuals', label: 'Residual diagnostics' }]} onChange={value => setDisplay(value as 'fit' | 'residuals')} />
            <LabSelect label="Selected observation" value={String(selectedIndex)} options={samples.map((_, index) => ({ value: String(index), label: `Observation ${index + 1}` }))} onChange={value => setSelected(Number(value))} />
            <LabRange label="Selected area x₁" value={observation.x1} min={-1.5} max={1.5} step={0.05} decimals={2} onChange={value => edit('x1', value)} />
            <LabRange label="Selected distance x₂" value={observation.x2} min={-1.5} max={1.5} step={0.05} decimals={2} onChange={value => edit('x2', value)} />
            <LabRange label="Selected observed price y" value={observation.y} min={-4} max={6} step={0.05} decimals={2} onChange={value => edit('y', value)} /></>}
        {(mode === 'assumptions' || mode === 'features') && <LabSelect label="Observation weighting" value={weighted ? 'variance' : 'equal'} options={[{ value: 'equal', label: 'Equal weights (OLS)' }, { value: 'variance', label: 'Known inverse noise variances (WLS)' }]} onChange={value => setWeighted(value === 'variance')} />}
        {mode === 'assumptions' && preset !== 'collinear' && <LabRange label="Input correlation" value={correlation} min={0} max={0.99} step={0.01} decimals={2} onChange={value => { setCorrelation(value); setEdits({}); }} />}
        {preset === 'confounded' && <button type="button" className="lab-button" aria-pressed={showHidden} onClick={() => setShowHidden(current => !current)}>Reveal hidden common cause</button>}
        <button type="button" className="lab-button" onClick={() => { setSeed(current => current + 1); setEdits({}); setStep(0); }}>Resample observations</button>
        </>}
    </>;
    const explanation = <div className="lab-explanation"><h2>{TITLES[mode]}</h2>
        <p>These are simulated, centered house-price features. A linear model combines its features with coefficients; adding polynomial features keeps it linear in coefficients while changing its shape in the original input space.</p>
        <h3>What is actually optimized?</h3><p>The objective is weighted squared error divided by twice the total weight, plus λ/2 times the squared non-intercept coefficients. The intercept is unpenalized. QR solves a reorthogonalized factorization; a direct one-sided Jacobi SVD handles rank deficiency and minimum norm without explicit matrix inversion.</p>
        <p>For unweighted OLS the mathematical closed-form solution is β = X⁺y, where X⁺ is the pseudoinverse. When X has full column rank, this equals (XᵀX)⁻¹Xᵀy. That formula describes the answer; QR or SVD computes it without forming and inverting XᵀX. Fitted responses are the orthogonal projection of y onto the columns of X; weights change that geometry, and ridge changes the objective.</p>
        <p>GD, SGD, and mini-batch GD update coefficients from actual gradients. Mini batches are seeded subsets sampled without replacement, and their averaged gradients include the weight correction for uniform sampling. Stochastic steps use a decaying rate; a batch containing all rows equals full GD. The intercept is profiled to its optimal value at each step. Newton reaches the optimum in one exact step for this quadratic objective. The objective view shows the two-slope objective with this profiled intercept; it does not compress a six-feature objective into three dimensions.</p>
        <h3>Three-observation projection</h3><p>The separate projection view has exactly three observations, one predictor x = (−1, 0, 1), and an intercept column 1 = (1, 1, 1). Its three axes are the three response coordinates y₁, y₂, y₃. The SVD-computed fitted vector ŷ = b1 + βx lies in span(1, x), and the residual y−ŷ is perpendicular to both columns. Dot-product readouts verify that orthogonality. This sample-vector space is different from the data plot: that plot's vertical response gaps are not perpendicular distances to its fitted plane.</p>
        <p>In the fitting lesson, choose Manual coefficients to move the prediction plane directly. Errors are computed for your chosen coefficients; Copy fitted coefficients restores the computed optimizer. Choosing a manual plane does not train a model.</p>
        <h3>Fitting is different from inference</h3><p>Minimizing squares does not require Gaussian errors. Full column rank gives unique unregularized coefficients. A correctly specified linear mean and zero conditional mean errors support unbiased estimation. Correlated inputs can make coefficients unstable; exact collinearity makes separate effects unidentified.</p>
        <p>Heteroskedastic or correlated errors do not by themselves prevent fitting, but conventional independent, constant-variance standard errors become unreliable. Known inverse variance weights improve efficiency under their stated variance model. Gaussian assumptions concern conventional exact small-sample inference; no confidence interval is claimed here.</p>
        <h3>Prediction is different from causality</h3><p>In the hidden-factor preset, the model does not observe a common cause of area and price. The structural area effect is 1.2 because we defined that simulation; the fitted coefficient can differ. A predictive fit or a tidy residual plot cannot establish causal identification from observational data.</p>
        <p>The test observations are generated from a separate seed. Editing training points creates custom data; the test set retains the selected generating scenario. A few residual segments are drawn for clarity; all observations contribute to reported errors.</p>
    </div>;
    const equation = coefficients.map((coefficient, index) => `${index === 0 ? 'b' : `β${index}`}=${fmt(coefficient)}`).join(' · ');
    const metrics = isProjection ? [{ label: 'Projection residual norm', value: fmt(projection.errorNorm) }, { label: 'Residual · 1', value: fmt(projection.residualInterceptDot) }, { label: 'Residual · x', value: fmt(projection.residualFeatureDot) }, { label: 'Sample-space rank', value: `${projection.rank}/2` }]
        : [{ label: 'Training MSE', value: fmt(trainMSE) }, { label: 'Independent test MSE', value: fmt(testMSE) },
            { label: 'Design rank', value: `${fit.rank}/${dimensions}` }, { label: 'Condition number', value: fmt(fit.conditionNumber) },
            { label: mode === 'assumptions' ? 'Residual lag correlation' : 'Objective', value: fmt(mode === 'assumptions' ? residualLagCorrelation(samples, coefficients, basis) : regressionLoss(samples, coefficients, basis, ridge)) }];
    return <VisualLab title={TITLES[mode]} subtitle={isProjection ? 'Three responses form a vector; least squares projects it onto the design-column plane.' : mode === 'solvers' ? 'Compare computed routes to the same weighted least-squares objective.' : 'Manipulate observations and inspect a computed numeric prediction surface.'}
        controls={controls} metrics={metrics}
        insight={isProjection ? <>Separate three-observation dataset: x=(−1, 0, 1), y=({projectionResponses.map(fmt).join(', ')}). ŷ={fmt(projection.coefficients[0])}1 + {fmt(projection.coefficients[1])}x. Gold is 1; purple is x; blue is y; teal is ŷ; pink is the orthogonal residual.</>
            : <>{equation}. {mode === 'fit' && coefficientSource === 'manual' && 'Manually chosen coefficients; errors describe this plane. '}{mode === 'solvers' ? `${fit.method}: shown step ${currentStep}; final gradient norm ${fmt(fit.gradientNorm)}${fit.converged ? ' (converged).' : ' (iteration budget or step size leaves optimization error).'}` : NOTES[preset]}</>}
        explanation={explanation} challenge={isProjection ? 'Move y₂. The fitted vector remains in span(1, x), while the residual stays perpendicular to both design columns.' : mode === 'features' ? 'With zero noise and zero ridge, compare the linear and quadratic bases on the curved scenario.' : mode === 'solvers' ? 'Use collinear inputs: compare nonunique coefficients, then add ridge. Raise the learning rate and inspect actual loss.' : 'Move one observed price or choose manual coefficients. Watch the prediction surface and independent test error.'}>
        <SpatialScene {...spatial} equalScale={isProjection || mode !== 'solvers'} equalAxes={mode === 'solvers' && !isProjection ? [0,2] : undefined} axes={isProjection ? ['Response coordinate y₁', 'Response coordinate y₂', 'Response coordinate y₃'] : mode === 'solvers' ? ['Area coefficient β₁', 'Profiled objective', 'Distance coefficient β₂'] : [display === 'residuals' && preset === 'correlated-errors' ? 'Observation order / 10' : 'Area x₁ (centered)', display === 'residuals' ? 'Residual y − ŷ' : 'Price y (scaled)', 'Distance x₂ (centered)']}
            description={isProjection ? 'Exact three-observation response-space projection: y, its SVD fitted vector in span(1,x), and an orthogonal residual, with one axis per observation.' : mode === 'solvers' ? 'Computed least-squares objective surface with actual coefficient updates and direct optimum.' : `${TITLES[mode]}: observed points, computed ${basis} prediction surface, and response residuals. Selected observation can be edited with labeled sliders.`} />
    </VisualLab>;
}
