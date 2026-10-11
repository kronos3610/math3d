import { useId, useMemo, useState } from 'react';
import { SpatialScene, type LabVector, type SpatialSurface } from '../../components/3d/SpatialScene';
import { LabRange, LabSelect, VisualLab } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import { gaussianDensity, gaussianEllipse, gaussianSampleStats, ONE_SIGMA_PROBABILITY, sampleGaussian, type GaussianParameters, type GaussianSample } from './distributionsMath';

function GaussianTopView({ samples, parameters }: { samples: readonly GaussianSample[]; parameters: GaussianParameters }) {
    const id = useId();
    const extent = Math.max(3, ...samples.flatMap(point => [Math.abs(point.x), Math.abs(point.y)])) * 1.08;
    const project = (x: number, y: number) => [200 + x * 122 / extent, 140 - y * 122 / extent];
    const ellipse = gaussianEllipse(parameters).map(([x, y], i) => `${i ? 'L' : 'M'}${project(x, y).join(',')}`).join(' ') + ' Z';
    return <svg className="lab-svg-stage" viewBox="0 0 400 300" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Gaussian samples and one-sigma ellipse in input coordinates</title>
        <desc id={`${id}-desc`}>All {samples.length} observations are shown. Blue circles lie outside the ellipse; gold squares lie inside. Membership uses squared Mahalanobis distance at most one. The theoretical fraction is {(100 * ONE_SIGMA_PROBABILITY).toFixed(1)}%, independent of these standard deviations and correlation.</desc>
        <line x1="62" x2="338" y1="140" y2="140" stroke={VIZ.axis} /><line x1="200" x2="200" y1="9" y2="265" stroke={VIZ.axis} />
        <path d={ellipse} fill={VIZ.focus} fillOpacity="0.08" stroke={VIZ.focus} strokeWidth="2" />
        {samples.map((point, i) => { const [x, y] = project(point.x, point.y); return point.insideOneSigma ? <rect key={i} x={x - 2.3} y={y - 2.3} width="4.6" height="4.6" fill={VIZ.focus} /> : <circle key={i} cx={x} cy={y} r="2" fill={VIZ.data} />; })}
        {[-extent, 0, extent].map(value => <g key={value}><text x={project(value, 0)[0]} y="284" textAnchor="middle" fontSize="13" fill={VIZ.axis}>{value.toFixed(1)}</text><text x="55" y={project(0, value)[1] + 4} textAnchor="end" fontSize="13" fill={VIZ.axis}>{value.toFixed(1)}</text></g>)}
        <text x="345" y="144" fontSize="15" fill={VIZ.axis}>x</text><text x="208" y="18" fontSize="15" fill={VIZ.axis}>y</text><text x="200" y="298" textAnchor="middle" fontSize="12" fill={VIZ.axis}>Input coordinates · equal x/y scale</text>
    </svg>;
}

export default function Distributions() {
    const [sigmaX, setSigmaX] = useState(1), [sigmaY, setSigmaY] = useState(1), [correlation, setCorrelation] = useState(0);
    const [count, setCount] = useState(100), [seed, setSeed] = useState(19), [view, setView] = useState('density');
    const parameters = useMemo(() => ({ sigmaX, sigmaY, correlation }), [sigmaX, sigmaY, correlation]);
    const samples = useMemo(() => sampleGaussian(parameters, count, seed), [parameters, count, seed]);
    const stats = useMemo(() => gaussianSampleStats(samples), [samples]);
    const peak = 4 * Math.PI * gaussianDensity(0, 0, parameters);
    const scene = useMemo(() => {
        const columns = 49, extent = 4.2;
        const vertices: LabVector[] = Array.from({ length: columns * columns }, (_, index) => {
            const x = -extent + 2 * extent * (index % columns) / (columns - 1), y = -extent + 2 * extent * Math.floor(index / columns) / (columns - 1);
            return [x, 4 * Math.PI * gaussianDensity(x, y, parameters), y];
        });
        const surface: SpatialSurface = { vertices, columns, color: VIZ.truth, opacity: 0.28 };
        const outline = gaussianEllipse(parameters);
        return { surfaces: [surface],
            points: [...samples.map(point => ({ position: [point.x, 4 * Math.PI * gaussianDensity(point.x, point.y, parameters) + 0.04, point.y] as LabVector, color: point.insideOneSigma ? VIZ.focus : VIZ.data, radius: point.insideOneSigma ? 0.075 : 0.055 })),
                { position: [0, 4 * Math.PI * gaussianDensity(0, 0, parameters) + 0.08, 0] as LabVector, color: VIZ.truth, radius: 0.075, label: `Peak ${(4 * Math.PI * gaussianDensity(0, 0, parameters)).toFixed(3)}` }],
            paths: [{ points: outline.map(([x, y]) => [x, 0.015, y] as LabVector), color: VIZ.focus, width: 3 },
                ...[0.5, 1, 1.5, 2, 2.5, 3].map(radius => ({ points: outline.map(([x, y]) => [radius * x, 4 * Math.PI * gaussianDensity(radius * x, radius * y, parameters), radius * y] as LabVector), color: VIZ.truth, width: 1.5 }))] };
    }, [parameters, samples]);
    return <VisualLab backUrl="/probability" title="Gaussian distributions" subtitle={`Widen, narrow or tilt a two-dimensional Gaussian. Seed ${seed}; heights are 4π × density.`}
        legend={[
            { label: 'Surface', meaning: 'true density × 4π', color: VIZ.truth, shape: 'square' },
            { label: 'Samples', meaning: 'observed input coordinates', color: VIZ.data, shape: 'dot' },
            { label: '1σ ellipse', meaning: 'gold region and inside samples', color: VIZ.focus, shape: 'line' },
        ]}
        metrics={[{ label: 'Scaled peak', value: peak.toFixed(3) }, { label: 'Sample mean (x, y)', value: `(${stats.meanX.toFixed(2)}, ${stats.meanY.toFixed(2)})` }, { label: 'Sample std (x, y)', value: `(${stats.stdX.toFixed(2)}, ${stats.stdY.toFixed(2)})` }, { label: 'Inside 1σ ellipse', value: `${(100 * stats.fractionInside).toFixed(1)}%` }, { label: 'Theoretical fraction', value: `${(100 * ONE_SIGMA_PROBABILITY).toFixed(1)}%` }]}
        controls={<><LabRange label="Standard deviation σx" value={sigmaX} min={0.6} max={1.8} step={0.1} decimals={1} onChange={setSigmaX} /><LabRange label="Standard deviation σy" value={sigmaY} min={0.6} max={1.8} step={0.1} decimals={1} onChange={setSigmaY} /><LabRange label="Correlation ρ" value={correlation} min={-0.9} max={0.9} step={0.1} decimals={1} onChange={setCorrelation} />
            <LabSelect label="Sample count N" value={String(count)} options={[50, 100, 500].map(n => ({ value: String(n), label: String(n) }))} onChange={value => setCount(Number(value))} />
            <LabSelect label="Display" value={view} options={[{ value: 'density', label: '3D density and samples' }, { value: 'top', label: 'Top view: ellipse membership' }]} onChange={setView} /><button type="button" className="lab-button" onClick={() => setSeed(s => s + 1)}>Resample</button></>}
        insight={`The 1σ ellipse contains ${(100 * stats.fractionInside).toFixed(1)}% of these samples; the two-dimensional theory is 39.3%, not 68%. Changing spread changes height so the full density still integrates to 1. Correlation ${correlation.toFixed(1)} tilts the ellipse.`}
        challenge="Predict what happens to the peak when you double σx while keeping σy and ρ fixed. Then compare the 1σ sample fraction before and after."
        explanation={<div className="lab-explanation"><h2>Shape and probability</h2><p>σx and σy control marginal spread; ρ couples the two coordinates. The one-sigma ellipse is the set with Mahalanobis distance at most one. For two Gaussian coordinates its probability is 1−exp(−1/2), about 39.3%; the familiar 68% rule belongs to a one-dimensional interval.</p><p>The surface is an exact bivariate Gaussian density with height multiplied by 4π. Samples have only two random coordinates; their displayed heights place them on this surface and are not a third random variable. Top view shows their actual x/y coordinates and ellipse membership directly.</p><p>At fixed σy and ρ, doubling σx halves the peak. Probability is area/volume under a density, not the density at one point. The surface is drawn over the finite window [−4.2,4.2]²; samples outside it are retained in the drawing and statistics. The full mathematical density, including tails outside that window, integrates to one. Standard deviations in the sample readout use divisor N. Seeds keep comparisons reproducible; Resample changes the seed.</p></div>}>
        {view === 'top' ? <GaussianTopView samples={samples} parameters={parameters} /> : <SpatialScene {...scene} axes={['input x', '4π × density', 'input y']} description="A true Gaussian density scaled vertically by 4π with two-coordinate samples placed on its surface. Gold samples have Mahalanobis distance at most one; the gold ellipse lies on the input floor. Native top view can isolate ellipse membership." />}
    </VisualLab>;
}
