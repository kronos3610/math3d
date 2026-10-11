import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VisualLab, LabSelect } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';

// --- Constants ---
const A = 1.5;
const SEGMENTS = 60;
const RANGE = 6;
const FIXED_X = 1;      // fixed parameter for Probability mode
const FIXED_B = 4.5;    // fixed data for Likelihood mode
const MLE_X = FIXED_B / A;  // 3

const getDensity = (b: number, x: number) =>
    (Math.exp(-0.5 * Math.pow(b - A * x, 2)) / Math.sqrt(2 * Math.PI)) * 5;

export default function ProbabilityVsLikelihood() {
    const { topicId } = useParams();
    const [mode, setMode] = useState<'probability' | 'likelihood'>('probability');
    const isProbability = mode === 'probability';
    const vertices = useMemo(() => Array.from({ length: (SEGMENTS + 1) ** 2 }, (_, index): LabVector => {
        const b = -RANGE + 2 * RANGE * (index % (SEGMENTS + 1)) / SEGMENTS;
        const x = -RANGE + 2 * RANGE * Math.floor(index / (SEGMENTS + 1)) / SEGMENTS;
        return [b, getDensity(b, x), x];
    }), []);
    const curve = Array.from({ length: 121 }, (_, index): LabVector => {
        const t = -RANGE + 2 * RANGE * index / 120;
        return isProbability ? [t, getDensity(t, FIXED_X) + 0.05, FIXED_X] : [FIXED_B, getDensity(FIXED_B, t) + 0.05, t];
    });
    const plane: LabVector[] = isProbability ? [[-RANGE, 0, FIXED_X], [RANGE, 0, FIXED_X], [-RANGE, 2.2, FIXED_X], [RANGE, 2.2, FIXED_X]]
        : [[FIXED_B, 0, -RANGE], [FIXED_B, 0, RANGE], [FIXED_B, 2.2, -RANGE], [FIXED_B, 2.2, RANGE]];
    const peak: LabVector = isProbability ? [A * FIXED_X, getDensity(A * FIXED_X, FIXED_X), FIXED_X] : [FIXED_B, getDensity(FIXED_B, MLE_X), MLE_X];
    return <VisualLab title="Probability versus likelihood" subtitle="The same model, cut in two directions: vary the data or vary the parameter."
        backUrl={`/${topicId || 'probability'}`} metrics={[{ label: 'Held fixed', value: isProbability ? `x = ${FIXED_X}` : `b = ${FIXED_B}` },
            { label: 'Varied axis', value: isProbability ? 'data b' : 'parameter x' }, { label: 'Peak location', value: isProbability ? `b = ${A * FIXED_X}` : `x = ${MLE_X}` },
            { label: 'Peak density', value: (getDensity(peak[0], peak[2]) / 5).toFixed(4) }]}
        legend={[{ label: 'Surface', meaning: '5 × p(b | x)', color: VIZ.output, shape: 'square' }, { label: 'Cut and curve', meaning: 'current probability or likelihood section', color: VIZ.focus, shape: 'line' },
            { label: 'Peak', meaning: isProbability ? 'most probable data' : 'maximum-likelihood parameter', color: VIZ.truth }]}
        controls={<LabSelect label="View" value={mode} options={[{ value: 'probability', label: 'Probability: fix parameter, vary data' }, { value: 'likelihood', label: 'Likelihood: fix data, vary parameter' }]}
            onChange={value => setMode(value as 'probability' | 'likelihood')} />}
        insight={isProbability ? `With x = ${FIXED_X}, data b follows N(${A * FIXED_X}, 1). The density integrates to 1 over b.`
            : `With b = ${FIXED_B}, the best parameter is x = b/1.5 = ${MLE_X}. Likelihood is a score over x; it is not a probability distribution over x.`}
        challenge="Before switching views, predict which floor axis the highlighted curve will follow and where its peak will move."
        explanation={<div className="lab-explanation"><p>The model is b = 1.5x + Gaussian noise with standard deviation 1. Probability holds x = 1 and varies b. Likelihood holds observed b = 4.5 and varies x.</p>
            <p>Both sections use the same Gaussian density. The surface height is 5 × density for visibility; the metric reports the unscaled density. The likelihood integrates to 1/1.5 over x, so treating it as a parameter probability would require additional inference assumptions and normalization.</p></div>}>
        <SpatialScene description={`The same Gaussian ridge with a ${isProbability ? 'fixed parameter probability' : 'fixed data likelihood'} section and its peak.`}
            axes={['observed data b', '5 × density', 'parameter x']} surfaces={[{ vertices, columns: SEGMENTS + 1, color: VIZ.output, opacity: 0.2 }, { vertices: plane, columns: 2, color: VIZ.focus, opacity: 0.12 }]}
            paths={[{ points: curve, color: VIZ.focus, width: 4 }]} points={[{ position: peak, color: VIZ.truth, radius: 0.12, label: isProbability ? 'Most probable b' : 'MLE x' }]} />
    </VisualLab>;
}
