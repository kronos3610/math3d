import { VIZ } from '../../data/palette';
import { useMemo, useState } from 'react';
import { SpatialScene, type SpatialPoint, type SpatialPath } from '../../components/3d/SpatialScene';
import { LabPlayback, LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import {
    createFeatureProblem, createRegressionData, featureDescent, featureLoss, fitPolynomial,
    measureLoss, polynomialPrediction, regressionMSE, regressionTruth, type LossKind,
} from '../../utils/ml-losses';

export type LossLabMode = 'losses' | 'conditioning' | 'validation';
export interface LossLabProps { mode?: LossLabMode; }
type Position = [number, number, number];
const LOSS_NAMES: Record<LossKind, string> = { squared: 'Half squared error', absolute: 'Absolute error', huber: 'Huber loss', bce: 'Bernoulli cross entropy' };

function LossGeometry() {
    const [kind, setKind] = useState<LossKind>('squared');
    const [prediction, setPrediction] = useState(1.5);
    const [target, setTarget] = useState(0);
    const [delta, setDelta] = useState(1);
    const measurement = useMemo(() => measureLoss(kind, prediction, target, delta), [kind, prediction, target, delta]);
    const geometry = useMemo(() => {
        const vertices: Position[] = [];
        const width = kind === 'bce' ? 6 : 3;
        for (let row = 0; row <= 20; row++) for (let column = 0; column <= 30; column++) {
            const x = -width + column * 2 * width / 30;
            const y = kind === 'bce' ? row / 20 : -2 + row / 5;
            vertices.push([x, y, measureLoss(kind, x, y, delta).loss]);
        }
        const slice: Position[] = Array.from({ length: 81 }, (_, index) => {
            const x = -width + index * 2 * width / 80;
            return [x, target, measureLoss(kind, x, target, delta).loss];
        });
        const paths: SpatialPath[] = [{ points: slice, color: VIZ.truth, width: 3 }];
        if (measurement.slope !== null) paths.push({ points: [[prediction - 0.35, target, measurement.loss - 0.35 * measurement.slope], [prediction + 0.35, target, measurement.loss + 0.35 * measurement.slope]], color: VIZ.focus, width: 3 });
        return { surfaces: [{ vertices, columns: 31, color: VIZ.data, opacity: 0.42 }], paths,
            points: [{ position: [prediction, target, measurement.loss] as Position, color: VIZ.focus, radius: 0.13, label: `Loss = ${measurement.loss.toFixed(3)}` }] };
    }, [kind, prediction, target, delta, measurement]);
    const controls = <>
        <LabSelect label="Loss function" value={kind} options={Object.entries(LOSS_NAMES).map(([value, label]) => ({ value, label }))} onChange={value => {
            const next = value as LossKind; setKind(next);
            const bound = next === 'bce' ? 6 : 3;
            setPrediction(current => Math.max(-bound, Math.min(bound, current)));
            if (next === 'bce') setTarget(current => Math.min(1, Math.max(0, current)));
        }} />
        <LabRange label={kind === 'bce' ? 'Predicted logit' : 'Prediction'} value={prediction} min={kind === 'bce' ? -6 : -3} max={kind === 'bce' ? 6 : 3} step={0.05} decimals={2} onChange={setPrediction} />
        <LabRange label={kind === 'bce' ? 'Target class-1 chance' : 'Target'} value={target} min={kind === 'bce' ? 0 : -2} max={kind === 'bce' ? 1 : 2} step={0.05} decimals={2} onChange={setTarget} />
        {kind === 'huber' && <LabRange label="Huber transition δ" value={delta} min={0.25} max={2} step={0.25} decimals={2} onChange={setDelta} />}
        {kind === 'bce' && <div className="visual-lab-playback" role="group" aria-label="Binary target presets">
            <button type="button" className="lab-button" aria-pressed={target === 0} onClick={() => setTarget(0)}>Target class 0</button>
            <button type="button" className="lab-button" aria-pressed={target === 1} onClick={() => setTarget(1)}>Target class 1</button>
        </div>}
        <button type="button" className="lab-button" onClick={() => { setPrediction(kind === 'bce' ? target >= 0.5 ? -4 : 4 : target > 0 ? target - 1.8 : target + 1.8); }}>Try a large mistake</button>
    </>;
    const explanation = <SceneExplanation title="Loss functions and their gradients" summary="A loss turns a prediction and a target into a cost. Its slope determines a local gradient-descent direction.">
        <ExplanationSection title="Read the geometry">
            <p>The axes are prediction, target, and actual computed loss. The green slice holds the target fixed. The yellow point is the selected example, and its straight yellow tangent shows the derivative with respect to the prediction. The mesh samples the same objective on a finite grid; the selected measurements use the exact formula.</p>
            <p>For residual r=prediction−target, half squared error is ½r² with slope r. Absolute error is |r| with slope ±1 away from zero. At zero, absolute loss has no unique derivative: any subgradient in [−1,1] is valid, so this scene does not invent a tangent.</p>
            <p>Huber is ½r² inside |r|≤δ and δ(|r|−½δ) outside. Its gradient is continuous, but its curvature changes at ±δ. Large residuals keep a bounded gradient magnitude δ. This reduces an outlier's influence relative to squared loss; it does not make all outliers harmless.</p>
        </ExplanationSection>
        <ExplanationSection title="Classification uses a logit">
            <p>For Bernoulli cross entropy, the prediction axis is a logit z, and p=sigmoid(z). The stable loss is max(z,0)−yz+log(1+exp(−|z|)); its derivative is p−y. Class targets are y=0 or y=1. The intermediate target-axis values are soft class-1 chances, representing expected cross entropy under that Bernoulli target.</p>
            <p>A confidently wrong binary prediction becomes expensive, while a correct confident prediction approaches zero loss. A soft target's minimum is generally positive: it contains the entropy of the target distribution. A sigmoid model output is not automatically a calibrated real-world probability.</p>
        </ExplanationSection>
        <ExplanationSection title="Choosing an objective changes learning">
            <p>Squared loss fits a conditional mean; absolute loss fits a conditional median. Huber trades quadratic behavior near the center for linear tails. Bernoulli cross entropy is appropriate to binary or probabilistic binary targets, not arbitrary regression values. This geometry selects an objective; it does not train a model or demonstrate generalization by itself.</p>
        </ExplanationSection>
    </SceneExplanation>;
    return <VisualLab title="Loss functions" subtitle="Move a prediction away from its target and compare the cost and its slope." controls={controls}
        metrics={[
            { label: 'Selected loss', value: measurement.loss.toFixed(4) },
            { label: 'Prediction derivative', value: measurement.slope === null ? 'not unique at zero' : measurement.slope.toFixed(4) },
            { label: kind === 'bce' ? 'Sigmoid probability' : 'Residual', value: (measurement.probability ?? prediction - target).toFixed(4) },
        ]} insight={`${LOSS_NAMES[kind]}: ${kind === 'bce' ? `logit ${prediction.toFixed(2)} gives p=${measurement.probability!.toFixed(3)}` : `prediction ${prediction.toFixed(2)}, target ${target.toFixed(2)}`}. ${measurement.slope === null ? 'At the absolute-loss corner there is a set of valid subgradients, not one ordinary derivative.' : `The local slope is ${measurement.slope.toFixed(3)}; gradient descent would move the prediction ${measurement.slope > 0 ? 'down' : measurement.slope < 0 ? 'up' : 'neither direction to first order'}.`}`}
        challenge="Compare the same large residual under squared, absolute, and Huber loss; then switch to a confidently wrong binary prediction."
        explanation={explanation}>
        <SpatialScene {...geometry} equalScale={false} axes={[kind === 'bce' ? 'predicted logit' : 'prediction', kind === 'bce' ? 'target class-1 chance' : 'target', 'loss']}
            description="Actual loss surface over prediction and target, with the fixed-target green curve and local yellow derivative tangent. Axes are independently scaled." />
    </VisualLab>;
}

function ConditioningLab() {
    const [scale, setScale] = useState(5);
    const [correlation, setCorrelation] = useState(0.6);
    const [standardize, setStandardize] = useState(false);
    const [rate, setRate] = useState(0.03);
    const [step, setStep] = useState(0);
    const [view, setView] = useState('loss');
    const problem = useMemo(() => createFeatureProblem(scale, correlation, standardize), [scale, correlation, standardize]);
    const descent = useMemo(() => featureDescent(problem, rate, 60), [problem, rate]);
    const currentStep = Math.min(step, descent.steps.length - 1);
    const current = descent.steps[currentStep];
    const maximumRate = 2 / problem.eigenvalues[1];
    const surface = useMemo(() => {
        const radius = Math.max(2, ...problem.optimum.map(value => Math.abs(value) * 1.3));
        const vertices: Position[] = [];
        for (let row = 0; row <= 30; row++) for (let column = 0; column <= 30; column++) {
            const first = -radius + column * 2 * radius / 30; const second = -radius + row * 2 * radius / 30;
            vertices.push([first, second, featureLoss(problem, [first, second])]);
        }
        return { vertices, columns: 31, color: VIZ.data, opacity: 0.42 };
    }, [problem]);
    const controls = <>
        <LabRange label="Feature 2 scale" value={scale} min={0.2} max={8} step={0.2} decimals={1} onChange={value => { setScale(value); setStep(0); }} />
        <LabRange label="Feature correlation" value={correlation} min={0} max={0.98} step={0.02} decimals={2} onChange={value => { setCorrelation(value); setStep(0); }} />
        <button type="button" className="lab-button" aria-pressed={standardize} onClick={() => { setStandardize(current => !current); setStep(0); }}>{standardize ? 'Standardized features' : 'Raw feature units'}</button>
        <LabRange label="Gradient-descent learning rate" value={rate} min={0.005} max={0.3} step={0.005} decimals={3} onChange={value => { setRate(value); setStep(0); }} />
        <LabSelect label="View" value={view} options={[{ value: 'loss', label: 'Two-weight loss + actual descent' }, { value: 'features', label: 'Actual feature-space data' }]} onChange={setView} />
        <LabPlayback step={currentStep} max={descent.steps.length - 1} onStep={setStep} />
        <button type="button" className="lab-button" onClick={() => setStep(descent.steps.length - 1)}>Show computed final step</button>
    </>;
    const explanation = <SceneExplanation title="Feature scaling and conditioning" summary="A two-feature linear regression has the same predictions available after a change of units, but gradient descent can become much harder.">
        <ExplanationSection title="A real two-weight objective">
            <p>Thirty-six points come from two orthogonal, zero-mean latent signals. Feature 2 mixes them according to the correlation control, then changes units according to the scale control. The target is the fixed combination 1.2 times the first latent signal minus 0.7 times the independent signal. No random labels are added.</p>
            <p>The fitted prediction is w₁x₁+w₂x₂, with loss ½ times mean squared error. The exact Hessian is H=XᵀX/n. Its condition number is largest eigenvalue divided by smallest. A large ratio means some weight directions have much larger curvature than others.</p>
        </ExplanationSection>
        <ExplanationSection title="What standardization fixes">
            <p>Standardization divides each feature by its population standard deviation; both means are already zero. It changes weight units, not the set of available predictions. It removes unequal marginal scale but leaves feature correlation in place. Nearly duplicate features can remain poorly conditioned after standardization.</p>
            <p>The feature-space view displays the two actual feature values and their actual regression target. The loss view displays actual weight coordinates and loss; green iterates are computed full-batch gradient-descent updates from zero, and yellow is the selected update. The landscape's axes are independently scaled for legibility, so use the eigenvalues and condition number to compare numerical conditioning.</p>
        </ExplanationSection>
        <ExplanationSection title="A rate can be too large">
            <p>For this positive-definite quadratic, constant-rate descent converges when 0&lt;η&lt;2/λmax. The displayed stability bound applies to this exact objective, not all neural networks. Play reveals up to 60 real updates; it does not refit the data at each frame. If loss would exceed 1,000,000 or become nonfinite, computation stops before adding that update rather than displaying invalid coordinates.</p>
            <p>The sampled surface shows a bounded neighborhood around the optimum. Diverging iterates can leave that neighborhood. The plotted path is not clipped or fabricated; changing the rate recomputes it.</p>
        </ExplanationSection>
    </SceneExplanation>;
    const featurePoints: SpatialPoint[] = problem.points.map(point => ({ position: [...point.features, point.target] as Position, color: VIZ.truth, radius: 0.07 }));
    const path: Position[] = descent.steps.slice(0, currentStep + 1).map(row => [...row.weights, row.loss] as Position);
    return <VisualLab title="Scaling and conditioning" subtitle="Change feature units and correlation, then watch real gradient-descent updates." controls={controls}
        metrics={[
            { label: 'Hessian condition number', value: problem.condition.toFixed(2) },
            { label: 'Curvature eigenvalues', value: problem.eigenvalues.map(value => value.toFixed(3)).join(' / ') },
            { label: 'Learning-rate stability bound', value: maximumRate.toFixed(4) },
            { label: 'Current half MSE', value: current.loss.toFixed(5) },
        ]} insight={`${standardize ? 'Standardized' : 'Raw'} features. At update ${currentStep}: w=(${current.weights.map(value => value.toFixed(3)).join(', ')}). ${rate < maximumRate ? 'This rate is below the quadratic stability bound.' : 'This rate reaches or exceeds the stability bound; convergence is not guaranteed.'}${descent.stopped ? ' The computed path stopped before loss exceeded 1,000,000.' : ''}`}
        challenge="Compare raw and standardized features at the same learning rate, then increase correlation toward 0.98."
        explanation={explanation}>
        {view === 'features' ? <SpatialScene points={featurePoints} axes={['feature 1', 'feature 2', 'target']}
            description="Actual two-feature regression data. Scaling changes feature units; correlation narrows the feature cloud. Equal scaling preserves the feature geometry." />
            : <SpatialScene surfaces={[surface]} paths={[{ points: path, color: VIZ.truth, width: 3 }]} points={[
                { position: [...problem.optimum, featureLoss(problem, problem.optimum)] as Position, color: VIZ.error, label: 'Exact optimum' },
                { position: [...current.weights, current.loss] as Position, color: VIZ.focus, radius: 0.12, label: `Update ${currentStep}` },
            ]} equalScale={false} axes={['weight 1', 'weight 2', 'half mean squared error']}
                description="Actual two-weight quadratic loss landscape with the computed gradient-descent path and exact least-squares optimum. Axes are independently scaled." />}
    </VisualLab>;
}

function ValidationLab() {
    const [degree, setDegree] = useState(3);
    const [count, setCount] = useState(12);
    const [noise, setNoise] = useState(0.25);
    const [nonlinear, setNonlinear] = useState(true);
    const [outlier, setOutlier] = useState(false);
    const [seed, setSeed] = useState(27);
    const data = useMemo(() => createRegressionData(count, noise, nonlinear, outlier, seed), [count, noise, nonlinear, outlier, seed]);
    const coefficients = useMemo(() => fitPolynomial(data.training, degree), [data, degree]);
    const trainingError = regressionMSE(data.training, coefficients);
    const validationError = regressionMSE(data.validation, coefficients);
    const scene = useMemo(() => {
        const predict = (input: number) => polynomialPrediction(input, coefficients);
        const points: SpatialPoint[] = [
            ...data.training.map(point => ({ position: [point.input, predict(point.input), point.target] as Position, color: VIZ.data, radius: 0.09 })),
            ...data.validation.map(point => ({ position: [point.input, predict(point.input), point.target] as Position, color: VIZ.error, radius: 0.05 })),
        ];
        const paths: SpatialPath[] = data.training.map(point => ({ points: [[point.input, predict(point.input), predict(point.input)], [point.input, predict(point.input), point.target]], color: VIZ.data, width: 1 }));
        const truth: Position[] = []; const fitted: Position[] = [];
        for (let index = 0; index <= 80; index++) {
            const input = -1 + index / 40; const target = regressionTruth(input, nonlinear);
            truth.push([input, target, target]); fitted.push([input, predict(input), target]);
        }
        paths.push({ points: truth, color: VIZ.axis, dashed: true }, { points: fitted, color: VIZ.truth, width: 3 });
        const extent = Math.max(1.5, ...points.flatMap(point => [Math.abs(point.position[1]), Math.abs(point.position[2])]));
        return { points, paths, surfaces: [{ vertices: [[-1, -extent, -extent], [1, -extent, -extent], [-1, extent, extent], [1, extent, extent]] as Position[], columns: 2, color: '#64748b', opacity: 0.18 }] };
    }, [data, coefficients, nonlinear]);
    const controls = <>
        <LabRange label="Polynomial degree" value={degree} min={1} max={8} onChange={setDegree} />
        <LabRange label="Training sample count" value={count} min={6} max={30} onChange={setCount} />
        <LabRange label="Noise standard deviation" value={noise} min={0} max={0.7} step={0.05} decimals={2} onChange={setNoise} />
        <LabSelect label="Underlying relationship" value={nonlinear ? 'nonlinear' : 'linear'} options={[{ value: 'linear', label: 'Linear: 1.2x − 0.2' }, { value: 'nonlinear', label: 'Nonlinear: sin(πx)' }]} onChange={value => setNonlinear(value === 'nonlinear')} />
        <button type="button" className="lab-button" aria-pressed={outlier} onClick={() => setOutlier(current => !current)}>{outlier ? 'Training outlier added' : 'Add one training outlier'}</button>
        <button type="button" className="lab-button" onClick={() => setSeed(current => current + 1)}>Resample both sets</button>
    </>;
    const explanation = <SceneExplanation title="Training and validation" summary="Fit only the blue training examples, then measure prediction error on the independent pink validation examples.">
        <ExplanationSection title="A prediction versus its target">
            <p>The axes are input, fitted prediction, and observed target. The translucent plane prediction=target means zero error. Blue training points and pink validation points lie away from that plane when predictions miss their targets. The blue segments show training residuals along the target axis. The green curve compares the fit with the noiseless truth; the dashed gray curve is the truth on the zero-error plane.</p>
            <p>The model is a polynomial with degree+1 coefficients, fit by minimizing squared error on the training set only. A fixed ridge coefficient 10⁻⁸ makes high-degree solves stable; this tiny numerical regularizer is included in every fit. The 80 validation observations use independent noise and input locations. Changing degree keeps both datasets fixed; Resample both sets draws a new deterministic seed.</p>
        </ExplanationSection>
        <ExplanationSection title="Assumptions you can change">
            <p>Choose a truly linear relationship or sin(πx). Independent Gaussian noise has the selected standard deviation. The optional training outlier adds 2.5 to one training target; it is not added to validation. A flexible polynomial may lower training error while reacting to noise or that outlier, which can increase validation error.</p>
            <p>The two measured MSEs are finite-sample observations, not an exact population bias–variance decomposition. Validation error can occasionally be below training error. A single split does not prove one model is best; resample and compare. Choosing degree repeatedly using this set makes it a model-selection set, not an untouched final test set.</p>
        </ExplanationSection>
        <ExplanationSection title="Connect this to loss geometry">
            <p>Every model here uses squared error. The outlier therefore contributes a large squared residual and pulls the fit. The loss-functions lesson explains why absolute or Huber objectives would give a large residual less gradient influence. More coefficients also make the polynomial feature matrix harder to condition, even when training error improves.</p>
        </ExplanationSection>
    </SceneExplanation>;
    return <VisualLab title="Training and validation" subtitle="A better fit to the training set can still make worse predictions on new examples." controls={controls}
        metrics={[
            { label: 'Training MSE', value: trainingError.toFixed(4) },
            { label: 'Validation MSE', value: validationError.toFixed(4) },
            { label: 'Validation − training', value: (validationError - trainingError).toFixed(4) },
            { label: 'Fitted coefficients', value: degree + 1 },
        ]} insight={`Blue: ${count} training points used for fitting. Pink: 80 independent validation points used only for measurement. Degree ${degree}${outlier ? ' with one training outlier' : ''}; training MSE ${trainingError.toFixed(3)}, validation MSE ${validationError.toFixed(3)}.`}
        challenge="Add an outlier, compare degrees 1 and 8, and resample before deciding which model predicts better."
        explanation={explanation}>
        <SpatialScene {...scene} equalScale={false} axes={['input', 'fitted prediction', 'observed target']}
            description="Actual fitted polynomial predictions and observed targets for blue training and pink validation points. The plane prediction equals target marks zero error. Axes are independently scaled." />
    </VisualLab>;
}

export default function LossLab({ mode = 'losses' }: LossLabProps) {
    if (mode === 'conditioning') return <ConditioningLab />;
    if (mode === 'validation') return <ValidationLab />;
    return <LossGeometry />;
}
