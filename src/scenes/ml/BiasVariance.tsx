import { useId, useMemo, useState } from 'react';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { ExperimentLayout } from '../../components/layout/ExperimentLayout';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import {
    BIAS_VARIANCE_ENSEMBLE_SIZE,
    BIAS_VARIANCE_MAX_DEGREE,
    runBiasVarianceSweep,
} from '../../utils/bias-variance';
import type { BiasVarianceExperiment } from '../../utils/bias-variance';

const COLORS = {
    signal: 'var(--lab-truth, #34d399)',
    fit: 'var(--lab-fit, #60a5fa)',
    mean: 'var(--lab-variation, #c4b5fd)',
    sample: 'var(--lab-noise, #fbbf24)',
    bias: 'var(--lab-variation, #c4b5fd)',
    variance: 'var(--lab-fit, #60a5fa)',
    noise: 'var(--lab-noise, #fbbf24)',
    training: 'var(--lab-truth, #34d399)',
    test: 'var(--lab-test, #fb7185)',
};

function formatError(value: number): string {
    return value >= 100 ? value.toExponential(2) : value.toFixed(3);
}

interface PredictionChartProps {
    experiment: BiasVarianceExperiment;
    noiseStd: number;
}

function PredictionChart({ experiment, noiseStd }: PredictionChartProps) {
    const chartId = useId();
    const { grid, signalValues, predictions, meanPrediction, predictionStd, exampleSamples } = experiment;
    const left = 88;
    const right = 680;
    const top = 24;
    const bottom = 290;
    const limit = Math.max(2, 1.8 + 3 * noiseStd);
    const xPosition = (x: number) => left + (x + 1) * (right - left) / 2;
    const yPosition = (y: number) => bottom - (y + limit) * (bottom - top) / (2 * limit);
    const path = (values: readonly number[]) => values.map((y, index) =>
        `${index === 0 ? 'M' : 'L'}${xPosition(grid[index]).toFixed(2)},${yPosition(y).toFixed(2)}`).join(' ');
    const band = [
        ...grid.map((x, index) => `${xPosition(x)},${yPosition(meanPrediction[index] + predictionStd[index])}`),
        ...grid.map((x, index) => `${xPosition(x)},${yPosition(meanPrediction[index] - predictionStd[index])}`).reverse(),
    ].join(' ');
    const hasClippedFits = predictions.some(fit => fit.some(value => Math.abs(value) > limit)) ||
        meanPrediction.some((value, index) => Math.abs(value) + predictionStd[index] > limit);

    return (
        <figure className="learning-lab">
            <svg className="lab-chart" viewBox="0 0 720 340" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
                <title id={`${chartId}-title`}>Fitted curves across independent training sets</title>
                <desc id={`${chartId}-description`}>
                    {experiment.ensembleSize} independently fitted degree {experiment.degree} polynomials are shown
                    with the true signal, their mean, and a band of plus or minus one ensemble standard deviation.
                    Filled dots are the first training sample. The vertical range is {-limit.toFixed(1)} to {limit.toFixed(1)}.
                </desc>
                <defs><clipPath id={`${chartId}-clip`}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
                {[-limit, -limit / 2, 0, limit / 2, limit].map(value => (
                    <g key={value}>
                        <line x1={left} y1={yPosition(value)} x2={right} y2={yPosition(value)} stroke="currentColor" opacity="0.12" />
                        <text x={left - 10} y={yPosition(value) + 5} textAnchor="end" fill="currentColor" fontSize="13">{value.toFixed(1)}</text>
                    </g>
                ))}
                {[-1, -0.5, 0, 0.5, 1].map(value => (
                    <text key={value} x={xPosition(value)} y={bottom + 22} textAnchor="middle" fill="currentColor" fontSize="13">{value}</text>
                ))}
                <g clipPath={`url(#${chartId}-clip)`}>
                    <polygon points={band} fill={COLORS.mean} opacity="0.16" />
                    {predictions.map((fit, index) => <path key={index} d={path(fit)} fill="none" stroke={COLORS.fit} strokeWidth="1" opacity="0.16" />)}
                    <path d={path(signalValues)} fill="none" stroke={COLORS.signal} strokeWidth="3" strokeDasharray="7 4" />
                    <path d={path(meanPrediction)} fill="none" stroke={COLORS.mean} strokeWidth="3" />
                    {exampleSamples.map((sample, index) =>
                        <circle key={index} cx={xPosition(sample.x)} cy={yPosition(sample.y)} r="3.2" fill={COLORS.sample} />)}
                </g>
                <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="currentColor" opacity="0.4" />
                <text x={(left + right) / 2} y="333" fill="currentColor" fontSize="14" textAnchor="middle">Input x</text>
                <text x="17" y={(top + bottom) / 2} fill="currentColor" fontSize="14" textAnchor="middle" transform={`rotate(-90 17 ${(top + bottom) / 2})`}>Prediction / response y</text>
            </svg>
            <figcaption>
                <div className="lab-legend">
                    <span style={{ color: COLORS.signal }}>Dashed: true signal</span>
                    <span style={{ color: COLORS.fit }}>Thin lines: individual fits</span>
                    <span style={{ color: COLORS.mean }}>Thick line: mean ± one SD</span>
                    <span style={{ color: COLORS.sample }}>Dots: one training sample</span>
                </div>
                {hasClippedFits && <p className="lab-note">Some fits or uncertainty bands extend beyond the visible y range. All predictions are included in the error metrics.</p>}
            </figcaption>
        </figure>
    );
}

interface ComplexityChartProps {
    experiments: readonly BiasVarianceExperiment[];
    selectedDegree: number;
}

function ComplexityChart({ experiments, selectedDegree }: ComplexityChartProps) {
    const chartId = useId();
    const left = 88;
    const right = 680;
    const top = 24;
    const bottom = 205;
    const maximum = Math.max(0.01, ...experiments.flatMap(result => [result.trainingMSE, result.testMSE, result.expectedTestMSE])) * 1.1;
    const xPosition = (degree: number) => left + (degree - 1) * (right - left) / (BIAS_VARIANCE_MAX_DEGREE - 1);
    const yPosition = (value: number) => bottom - value / maximum * (bottom - top);
    const path = (metric: 'trainingMSE' | 'testMSE' | 'expectedTestMSE') => experiments.map((result, index) =>
        `${index === 0 ? 'M' : 'L'}${xPosition(result.degree).toFixed(2)},${yPosition(result[metric]).toFixed(2)}`).join(' ');
    const series = [
        { metric: 'trainingMSE', color: COLORS.training, dash: undefined, marker: 'circle' },
        { metric: 'testMSE', color: COLORS.test, dash: '2 4', marker: 'square' },
        { metric: 'expectedTestMSE', color: COLORS.mean, dash: '8 4', marker: 'diamond' },
    ] as const;

    return (
        <figure className="learning-lab">
            <svg className="lab-chart" viewBox="0 0 720 255" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
                <title id={`${chartId}-title`}>Training and test error versus model complexity</title>
                <desc id={`${chartId}-description`}>
                    Mean squared errors for polynomial degrees one to {BIAS_VARIANCE_MAX_DEGREE} using the same
                    training and test samples at each degree. A vertical line marks selected degree {selectedDegree}.
                    Training error, independent test error, and the grid bias–variance–noise sum are separate series.
                </desc>
                {[0, maximum / 2, maximum].map(value => (
                    <g key={value}>
                        <line x1={left} y1={yPosition(value)} x2={right} y2={yPosition(value)} stroke="currentColor" opacity="0.12" />
                        <text x={left - 10} y={yPosition(value) + 5} textAnchor="end" fill="currentColor" fontSize="13">{formatError(value)}</text>
                    </g>
                ))}
                <line x1={xPosition(selectedDegree)} y1={top} x2={xPosition(selectedDegree)} y2={bottom} stroke="currentColor" strokeDasharray="3 4" opacity="0.4" />
                {series.map(({ metric, color, dash, marker }) => (
                    <g key={metric}>
                        <path d={path(metric)} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={dash} />
                        {experiments.map(result => {
                            const x = xPosition(result.degree);
                            const y = yPosition(result[metric]);
                            if (marker === 'square') return <rect key={result.degree} x={x - 3.5} y={y - 3.5} width="7" height="7" fill={color} />;
                            if (marker === 'diamond') return <polygon key={result.degree} points={`${x},${y - 4.5} ${x + 4.5},${y} ${x},${y + 4.5} ${x - 4.5},${y}`} fill={color} />;
                            return <circle key={result.degree} cx={x} cy={y} r="3.5" fill={color} />;
                        })}
                    </g>
                ))}
                {experiments.map(result => <text key={result.degree} x={xPosition(result.degree)} y={bottom + 22} textAnchor="middle" fill="currentColor" fontSize="13">{result.degree}</text>)}
                <text x={(left + right) / 2} y="250" fill="currentColor" fontSize="14" textAnchor="middle">Polynomial degree</text>
                <text x="17" y={(top + bottom) / 2} fill="currentColor" fontSize="14" textAnchor="middle" transform={`rotate(-90 17 ${(top + bottom) / 2})`}>Mean squared error</text>
            </svg>
            <figcaption className="lab-legend">
                <span style={{ color: COLORS.training }}>Solid / circles: training MSE</span>
                <span style={{ color: COLORS.test }}>Dotted / squares: independent test MSE</span>
                <span style={{ color: COLORS.mean }}>Dashed / diamonds: bias² + variance + noise</span>
            </figcaption>
        </figure>
    );
}

function ErrorDecomposition({ experiment }: { experiment: BiasVarianceExperiment }) {
    const chartId = useId();
    const parts = [
        { name: 'Squared bias', label: 'Bias²', value: experiment.squaredBias, color: COLORS.bias },
        { name: 'Estimator variance', label: 'Variance', value: experiment.variance, color: COLORS.variance },
        { name: 'Noise variance', label: 'Noise', value: experiment.noiseVariance, color: COLORS.noise },
    ];
    const maximum = Math.max(0.001, ...parts.map(part => part.value));

    return (
        <figure className="learning-lab">
            <svg className="lab-chart" viewBox="0 0 720 140" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
                <title id={`${chartId}-title`}>Prediction error decomposition for selected degree</title>
                <desc id={`${chartId}-description`}>
                    Squared bias {formatError(experiment.squaredBias)}, estimator variance {formatError(experiment.variance)},
                    and noise variance {formatError(experiment.noiseVariance)} sum to {formatError(experiment.expectedTestMSE)}.
                    Bars share a common linear scale.
                </desc>
                {parts.map((part, index) => (
                    <g key={part.name}>
                        <text x="154" y={28 + index * 42} fill="currentColor" textAnchor="end" fontSize="14">{part.label}</text>
                        <rect x="168" y={12 + index * 42} width={part.value / maximum * 420} height="23" rx="4" fill={part.color} />
                        <text x="610" y={28 + index * 42} fill="currentColor" fontSize="14">{formatError(part.value)}</text>
                    </g>
                ))}
            </svg>
            <figcaption className="lab-note">Bias² + estimator variance + irreducible noise = expected MSE for the finite ensemble on a uniform input grid.</figcaption>
        </figure>
    );
}

export default function BiasVariance() {
    const controlsId = useId();
    const [degree, setDegree] = useState(3);
    const [noiseStd, setNoiseStd] = useState(0.3);
    const [sampleSize, setSampleSize] = useState(40);
    const [seed, setSeed] = useState(2718);
    const experiments = useMemo(() => runBiasVarianceSweep({ noiseStd, sampleSize, seed }), [noiseStd, sampleSize, seed]);
    const experiment = experiments[degree - 1];
    const bestTestDegree = experiments.reduce((best, current) => current.testMSE < best.testMSE ? current : best).degree;
    const fields = [
        { id: 'degree', label: 'Model complexity (polynomial degree)', value: degree, min: 1, max: BIAS_VARIANCE_MAX_DEGREE, step: 1, change: setDegree, text: String(degree) },
        { id: 'noise', label: 'Noise standard deviation (σ)', value: noiseStd, min: 0, max: 1, step: 0.05, change: setNoiseStd, text: noiseStd.toFixed(2) },
        { id: 'samples', label: 'Training sample size', value: sampleSize, min: 16, max: 128, step: 8, change: setSampleSize, text: String(sampleSize) },
    ];
    const metrics = [
        { label: 'Training MSE', value: experiment.trainingMSE },
        { label: 'Independent test MSE', value: experiment.testMSE },
        { label: 'Squared bias', value: experiment.squaredBias },
        { label: 'Estimator variance', value: experiment.variance },
        { label: 'Irreducible noise (σ²)', value: experiment.noiseVariance },
        { label: 'Bias² + variance + noise', value: experiment.expectedTestMSE },
    ];

    const explanation = (
        <SceneExplanation title="Bias–Variance Tradeoff" summary="A model can miss the true pattern, vary across training sets, or face noise that no predictor can remove.">
            <ExplanationSection title="What is being fitted?">
                <p>Each of {BIAS_VARIANCE_ENSEMBLE_SIZE} independent training sets contains inputs uniformly sampled from [−1, 1] and responses y = f(x) + ε, where f(x) = sin(πx) + 0.35x² − 0.25 and ε is independent Gaussian noise with standard deviation σ.</p>
                <p>Each polynomial is fitted to minimize mean squared residuals with a fixed, tiny ridge penalty of 10⁻⁶ on non-intercept coefficients. This keeps high-degree fits numerically stable; it is part of the estimator whose bias and variance we measure.</p>
            </ExplanationSection>
            <ExplanationSection title="How to read bias and variance">
                <p>Squared bias measures how far the mean prediction lies from f(x). Estimator variance measures how much the fits vary around that mean. Both average over a uniform input grid; the shaded band is mean prediction ± one ensemble standard deviation, not a confidence interval.</p>
                <p>Variance divides by the number of fits, {BIAS_VARIANCE_ENSEMBLE_SIZE}. The decomposition is exact for this finite ensemble and grid. Its bias and variance approximate the values across all possible training sets.</p>
            </ExplanationSection>
            <ExplanationSection title="Why two test-error numbers?">
                <p>The bias² + variance + σ² sum averages over new response noise analytically. Independent test MSE uses {experiment.ensembleSize * experiment.testSize} fresh noisy observations, so random variation and grid approximation make the numbers differ.</p>
                <p>The same underlying draws are reused at every degree and noise setting to make comparisons easier. Resample training sets creates another deterministic ensemble.</p>
            </ExplanationSection>
            <ExplanationSection title="Try an experiment">
                <p>Begin at degree 1: the polynomial cannot follow the curved signal. Increase degree and watch squared bias. With high noise and a small sample, inspect fit variability and test error. Increase the sample size and check whether variance falls.</p>
                <p>The best degree is specific to the signal, noise, data, and estimator. A U-shaped test-error curve is common, but is not guaranteed on every finite experiment.</p>
            </ExplanationSection>
        </SceneExplanation>
    );

    return (
        <SceneContainer backUrl="/ml" explanation={explanation} defaultPanel="closed">
            <ExperimentLayout title="Bias–Variance Tradeoff" subtitle="Refit the same learning method on independent datasets and see where prediction error comes from.">
                <div className="learning-lab">
                    <PredictionChart experiment={experiment} noiseStd={noiseStd} />
                    <div className="lab-controls" role="group" aria-label="Bias–variance experiment settings">
                        {fields.map(field => (
                            <div key={field.id} className="lab-field">
                                <label className="lab-control-label" htmlFor={`${controlsId}-${field.id}`}>
                                    {field.label} <output htmlFor={`${controlsId}-${field.id}`}>{field.text}</output>
                                </label>
                                <input id={`${controlsId}-${field.id}`} type="range" min={field.min} max={field.max} step={field.step}
                                    value={field.value} onChange={event => field.change(Number(event.target.value))} />
                            </div>
                        ))}
                        <button className="lab-button" type="button" onClick={() => setSeed(current => current + 1)}>Resample training sets</button>
                    </div>
                    <p className="lab-readout" aria-live="polite">
                        {experiment.ensembleSize} independent fits · {sampleSize} training points per fit · selected degree {degree}.
                        {' '}Lowest observed test MSE in this sweep: degree {bestTestDegree}.
                    </p>
                    <dl className="lab-metrics">
                        {metrics.map(metric => <div className="lab-stat" key={metric.label}><dt>{metric.label}</dt><dd>{formatError(metric.value)}</dd></div>)}
                    </dl>
                    <ErrorDecomposition experiment={experiment} />
                    <ComplexityChart experiments={experiments} selectedDegree={degree} />
                    <p className="lab-note">These are measured results from a finite ensemble. Noise describes the observations; bias and variance describe the fitted estimator across training sets. Open Explain for the sampling assumptions.</p>
                </div>
            </ExperimentLayout>
        </SceneContainer>
    );
}
