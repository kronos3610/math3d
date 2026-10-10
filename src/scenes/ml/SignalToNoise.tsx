import { useId, useMemo, useState } from 'react';
import { ExperimentLayout } from '../../components/layout/ExperimentLayout';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { evaluatePolynomial } from '../../utils/regression';
import { runSignalNoiseExperiment, signalValue } from '../../utils/signal-noise';
import type { SignalNoiseExperiment } from '../../utils/signal-noise';

interface RangeFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    decimals?: number;
}

function RangeField({ label, value, min, max, step, onChange, decimals = 0 }: RangeFieldProps) {
    const id = useId();
    return (
        <div className="lab-field">
            <label className="lab-control-label" htmlFor={id}>
                <span>{label}</span>
                <output htmlFor={id}>{value.toFixed(decimals)}</output>
            </label>
            <input id={id} type="range" min={min} max={max} step={step} value={value}
                onChange={event => onChange(Number(event.target.value))} />
        </div>
    );
}

function formatValue(value: number | null): string {
    if (value === null) return 'Undefined (0 / 0)';
    if (value === Infinity) return '∞';
    if (value === -Infinity) return '−∞';
    if (Math.abs(value) >= 10000 || (value !== 0 && Math.abs(value) < 0.001)) return value.toExponential(2);
    return value.toFixed(3);
}

interface SignalChartProps {
    experiment: SignalNoiseExperiment;
    amplitude: number;
    noiseStd: number;
}

function SignalChart({ experiment, amplitude, noiseStd }: SignalChartProps) {
    const id = useId();
    const width = 800;
    const height = 350;
    const left = 65;
    const right = width - 22;
    const top = 18;
    const bottom = height - 46;
    const extent = Math.max(1, amplitude + 3 * noiseStd);
    const sx = (x: number) => left + (x + 1) * (right - left) / 2;
    const sy = (y: number) => bottom - (y + extent) * (bottom - top) / (2 * extent);
    const xs = Array.from({ length: 241 }, (_, i) => -1 + i / 120);
    const path = (predict: (x: number) => number) => xs.map((x, i) =>
        `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(2)},${sy(predict(x)).toFixed(2)}`).join(' ');
    const fitPath = path(x => evaluatePolynomial(experiment.coefficients, x));
    const clipped = xs.some(x => Math.abs(evaluatePolynomial(experiment.coefficients, x)) > extent)
        || experiment.trainingSamples.some(sample => Math.abs(sample.y) > extent)
        || experiment.testSamples.slice(0, 70).some(sample => Math.abs(sample.y) > extent);
    return (
        <figure className="learning-lab">
            <svg className="lab-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
                <title id={`${id}-title`}>Signal, noisy observations, and fitted polynomial</title>
                <desc id={`${id}-description`}>
                    The cyan curve is the true signal A sin(πx). Filled circles are training observations;
                    pink hollow squares are independent test observations. The dashed yellow curve is the fitted model.
                    {clipped ? ' Some observations or predictions extend beyond the vertical plot range.' : ''}
                </desc>
                <defs><clipPath id={`${id}-clip`}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
                {[-1, -0.5, 0, 0.5, 1].map(x => (
                    <g key={x}>
                        <line x1={sx(x)} x2={sx(x)} y1={top} y2={bottom} stroke="var(--border-glass-hover)" />
                        <text x={sx(x)} y={bottom + 22} textAnchor="middle" fill="var(--text-secondary)" fontSize="12">{x}</text>
                    </g>
                ))}
                {[-1, -0.5, 0, 0.5, 1].map(fraction => (
                    <g key={fraction}>
                        <line x1={left} x2={right} y1={sy(fraction * extent)} y2={sy(fraction * extent)} stroke="var(--border-glass-hover)" />
                        <text x={left - 10} y={sy(fraction * extent) + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="12">
                            {(fraction * extent).toFixed(1)}
                        </text>
                    </g>
                ))}
                <g clipPath={`url(#${id}-clip)`}>
                    {experiment.testSamples.slice(0, 70).map((sample, i) => (
                        <rect key={i} x={sx(sample.x) - 2.5} y={sy(sample.y) - 2.5} width={5} height={5}
                            fill="none" stroke="var(--lab-noise)" opacity={0.7} />
                    ))}
                    {experiment.trainingSamples.map((sample, i) => (
                        <circle key={i} cx={sx(sample.x)} cy={sy(sample.y)} r={3} fill="var(--text-primary)" opacity={0.8} />
                    ))}
                    <path d={path(x => signalValue(x, amplitude))} fill="none" stroke="var(--lab-truth)" strokeWidth={3} />
                    <path d={fitPath} fill="none" stroke="var(--lab-fit)" strokeWidth={2.5} strokeDasharray="8 5" />
                </g>
                <text x={(left + right) / 2} y={height - 4} textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Input x</text>
                <text transform={`translate(17 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Output y</text>
            </svg>
            <figcaption className="lab-legend">
                <span style={{ color: 'var(--lab-truth)' }}>━ True signal</span>
                <span style={{ color: 'var(--lab-fit)' }}>┄ Polynomial fit</span>
                <span>● Training observations</span>
                <span style={{ color: 'var(--lab-noise)' }}>□ Test observations (70 shown)</span>
            </figcaption>
            {clipped && <p className="lab-note">Some observations or predictions extend beyond the plotted range. Error metrics include them.</p>}
        </figure>
    );
}

export default function SignalToNoise() {
    const [amplitude, setAmplitude] = useState(1);
    const [noiseStd, setNoiseStd] = useState(0.35);
    const [sampleSize, setSampleSize] = useState(60);
    const [degree, setDegree] = useState(5);
    const [seed, setSeed] = useState(3610);
    const experiment = useMemo(() => runSignalNoiseExperiment({ amplitude, noiseStd, sampleSize, degree, seed }),
        [amplitude, noiseStd, sampleSize, degree, seed]);
    const { snr } = experiment;
    const seedId = useId();

    const explanation = (
        <div className="lab-explanation">
            <h3>Signal-to-noise ratio</h3>
            <p>Each observation is y = f(x) + ε, with f(x) = A sin(πx), x uniform on [−1, 1], and independent ε drawn from a Gaussian with mean 0 and standard deviation σ.</p>
            <p>SNR = Varₓ[f(x)] / σ² = (A² / 2) / σ². This uses the centered signal variance over the input distribution, rather than the variance of a particular noisy sample.</p>
            <p>In decibels, SNRdB = 10 log₁₀(SNR). Positive signal with zero noise gives infinite SNR. Zero signal with positive noise gives SNR 0 and −∞ dB. If both are zero, SNR is undefined.</p>
            <h3>Data quality and model error</h3>
            <p>SNR is a property of the data-generating process. Changing sample size or polynomial degree leaves it unchanged. Bias and variance describe an estimator across repeated training samples.</p>
            <p>Train MSE uses the observations fitted by least squares. Test MSE uses 2,000 independently generated observations and fluctuates with the seed. It includes the irreducible noise variance σ².</p>
            <p>The polynomial fit uses a tiny coefficient penalty (10⁻⁶, excluding its intercept) to stabilize estimates when samples are sparse.</p>
            <p>The signal MSE estimates the model’s error against the noise-free signal over a uniform grid. Signal MSE + σ² estimates the expected test error for this particular fit.</p>
            <p>Doubling A and σ preserves SNR but multiplies squared errors by four for the same sample locations and standardized noise. A dimensionless ratio does not determine absolute prediction error.</p>
        </div>
    );

    return (
        <SceneContainer backUrl="/ml" explanation={explanation} defaultPanel="closed">
            <ExperimentLayout title="Signal-to-Noise Ratio" subtitle="Separate the quality of the data from the quality of the fitted model.">
                <div className="learning-lab">
                <div className="lab-controls">
                    <RangeField label="Signal amplitude A" value={amplitude} min={0} max={3} step={0.1} decimals={1} onChange={setAmplitude} />
                    <RangeField label="Noise standard deviation σ" value={noiseStd} min={0} max={2} step={0.05} decimals={2} onChange={setNoiseStd} />
                    <RangeField label="Training sample size" value={sampleSize} min={10} max={200} step={10} onChange={setSampleSize} />
                    <RangeField label="Polynomial degree" value={degree} min={0} max={8} step={1} onChange={setDegree} />
                </div>
                <div className="lab-legend">
                    <div className="lab-field">
                        <label className="lab-control-label" htmlFor={seedId}>Random seed</label>
                        <input id={seedId} type="number" min={0} max={4294967295} step={1} value={seed}
                            onChange={event => {
                                const nextSeed = Number(event.target.value);
                                if (Number.isSafeInteger(nextSeed) && nextSeed >= 0 && nextSeed <= 4294967295) setSeed(nextSeed);
                            }} />
                    </div>
                    <button type="button" className="lab-button" onClick={() => setSeed(current => (current + 1) >>> 0)}>Resample observations</button>
                    <button type="button" className="lab-button" onClick={() => { setAmplitude(1); setNoiseStd(0.35); }}>Reference scale: A = 1, σ = 0.35</button>
                    <button type="button" className="lab-button" onClick={() => { setAmplitude(2); setNoiseStd(0.7); }}>Double scale: A = 2, σ = 0.70</button>
                </div>
                <p className="lab-note">Changing degree or sample size leaves SNR fixed. Use the two scale presets to compare equal SNR with different absolute errors.</p>
                <dl className="lab-metrics" aria-live="polite" aria-label="Signal-to-noise measurements">
                    <div className="lab-stat"><dt>SNR (linear)</dt><dd>{formatValue(snr.ratio)}</dd></div>
                    <div className="lab-stat"><dt>SNR (dB)</dt><dd>{formatValue(snr.decibels)}{snr.decibels === null ? '' : ' dB'}</dd></div>
                    <div className="lab-stat"><dt>Signal variance</dt><dd>{formatValue(snr.signalVariance)}</dd></div>
                    <div className="lab-stat"><dt>Noise variance / floor</dt><dd>{formatValue(snr.noiseVariance)}</dd></div>
                </dl>
                <SignalChart experiment={experiment} amplitude={amplitude} noiseStd={noiseStd} />
                <dl className="lab-metrics" aria-label="Prediction errors">
                    <div className="lab-stat"><dt>Train MSE</dt><dd>{formatValue(experiment.trainingMse)}</dd></div>
                    <div className="lab-stat"><dt>Independent test MSE</dt><dd>{formatValue(experiment.testMse)}</dd></div>
                    <div className="lab-stat"><dt>Signal MSE (grid estimate)</dt><dd>{formatValue(experiment.signalMse)}</dd></div>
                    <div className="lab-stat"><dt>Expected test MSE (estimate)</dt><dd>{formatValue(experiment.signalMse + snr.noiseVariance)}</dd></div>
                </dl>
                <p className="lab-note">SNR describes the data. Bias and variance describe how a learning algorithm behaves across repeated training samples. The noise floor is σ²; a model can still have additional error from its limited flexibility and fitted coefficients.</p>
                </div>
            </ExperimentLayout>
        </SceneContainer>
    );
}
