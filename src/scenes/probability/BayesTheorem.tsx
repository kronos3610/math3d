import { useId, useState, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { SceneContainer } from '../../components/layout/SceneContainer';
import BayesExplanation from '../../components/BayesExplanation';
import BayesPopulationFallback from '../../components/BayesPopulationFallback';
import { calculateBayes, type BayesParameters } from '../../utils/bayes';
import { formatBayesCount as count, formatBayesPercent as percent } from '../../utils/bayes-format';
import { BayesPopulation, type BayesView } from './BayesPopulation';

const DEFAULTS: BayesParameters = { prior: 0.1, likelihood: 0.9, falsePositiveRate: 0.1 };
const VIEWS: Array<{ id: BayesView; label: string }> = [
    { id: 'population', label: 'All emails' },
    { id: 'flags', label: 'Highlight flags' },
    { id: 'conditional', label: 'Only flagged' },
];

interface RateControlProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    children: ReactNode;
}

function RateControl({ label, value, onChange, children }: RateControlProps) {
    const id = useId();
    return <div className="bayes-visual-rate">
        <div className="bayes-visual-rate-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{percent(value)}</output></div>
        <input id={id} type="range" min={0} max={100} step={1} value={Math.round(value * 100)}
            aria-describedby={`${id}-help`} onChange={event => onChange(Number(event.target.value) / 100)} />
        <p id={`${id}-help`} className="bayes-visually-hidden">{children}</p>
    </div>;
}

export default function BayesTheorem() {
    const id = useId();
    const [parameters, setParameters] = useState<BayesParameters>(DEFAULTS);
    const [view, setView] = useState<BayesView>('conditional');
    const [has3D, setHas3D] = useState(false);
    const result = calculateBayes({ ...parameters, population: 1000 });
    const { eventCount: spam, complementCount: ordinary, eventAndEvidenceCount: flaggedSpam,
        nonEventAndEvidenceCount: flaggedOrdinary, evidenceCount: flagged, posteriorProbability: posterior } = result;
    const updateRate = (key: 'prior' | 'likelihood' | 'falsePositiveRate', value: number) =>
        setParameters(current => ({ ...current, [key]: value }));
    const applyPreset = (next: BayesParameters) => { setParameters(next); setView('conditional'); };
    const fractional = Math.abs(flagged - Math.round(flagged)) > 1e-8
        || Math.abs(flaggedSpam - Math.round(flaggedSpam)) > 1e-8;
    const caption = view === 'population' ? 'All 1,000 emails before filtering.'
        : view === 'flags' ? `${has3D ? 'Raised tiles' : 'Bright areas'} are flagged. Both spam and ordinary emails can be flagged.`
            : flagged === 0 ? 'No emails are flagged. Increase one of the flagging rates to create a group.'
                : `The flagged group is enlarged. Dim ${has3D ? 'tiles' : 'areas'} were not flagged.`;

    return <SceneContainer backUrl="/probability" explanation={<BayesExplanation parameters={parameters} result={result} />} defaultPanel="closed">
        <section className="bayes-visual-lesson" aria-labelledby={`${id}-title`}>
            <header className="bayes-visual-header">
                <div><h1 id={`${id}-title`}>Bayes' theorem</h1><p>Explore the population, then isolate the flagged emails.</p></div>
                <div className="bayes-visual-chance" aria-live="polite">
                    <span>Spam among flagged</span>
                    <output aria-label="Chance of spam after a flag" data-undefined={posterior === null}>
                        {posterior === null ? 'Undefined — no flagged emails' : percent(posterior)}
                    </output>
                    <span>Before filtering: {percent(parameters.prior)}</span>
                </div>
            </header>

            <div className="bayes-visual-stage">
                <SceneCanvas orthographic frameloop="demand" camera={{ position: [0, 12, 16], zoom: 35, near: 0.1, far: 100 }}
                    role="img" aria-label="3D Bayes email population: unflagged emails and the selected flagged group" aria-describedby={`${id}-description`}
                    onCreated={() => setHas3D(true)}
                    fallback={<BayesPopulationFallback parameters={parameters} result={result} view={view} />}>
                    <color attach="background" args={['#0b0f19']} />
                    <ambientLight intensity={0.7} />
                    <directionalLight position={[5, 12, 8]} intensity={1.5} />
                    <BayesPopulation parameters={parameters} view={view} />
                    <OrbitControls makeDefault enableDamping dampingFactor={0.08} enablePan={false}
                        minZoom={2} maxZoom={100} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.2}
                        minAzimuthAngle={-Math.PI / 3} maxAzimuthAngle={Math.PI / 3} target={[0, 0, 0]} />
                </SceneCanvas>
                <div className="bayes-visual-legend" aria-label="Email colors">
                    <span><i className="bayes-spam-swatch" aria-hidden="true" />Spam</span>
                    <span><i className="bayes-ordinary-swatch" aria-hidden="true" />Ordinary</span>
                </div>
                <p className="bayes-visual-caption">{caption}{has3D ? ' Drag to rotate; scroll or pinch to zoom.' : ''}</p>
                <p id={`${id}-description`} className="bayes-visually-hidden">
                    {count(spam)} spam and {count(ordinary)} ordinary emails before filtering.
                    The selected group contains {count(flaggedSpam)} spam and {count(flaggedOrdinary)} ordinary emails,
                    for {count(flagged)} flags. Each tile represents one email; partial tiles show fractional expected counts.
                    Use the three view buttons for the population, highlighted flags, and the isolated flagged group.
                    Open the scene panel's Explain tab for the complete worked example.
                </p>
            </div>

            <div className="bayes-visual-console">
                <div className="bayes-visual-toolbar">
                    <div className="bayes-visual-views" role="group" aria-label="Population view">
                        {VIEWS.map((stage, index) => <button key={stage.id} type="button" aria-pressed={view === stage.id} onClick={() => setView(stage.id)}>
                            <span aria-hidden="true">{index + 1}</span>{stage.label}
                        </button>)}
                    </div>
                    <div className="bayes-visual-presets">
                        <button type="button" className="lab-button" onClick={() => applyPreset(DEFAULTS)}>Reset example</button>
                        <button type="button" className="lab-button" onClick={() => applyPreset({ ...DEFAULTS, prior: 0.01 })}>Rare spam</button>
                        <button type="button" className="lab-button" onClick={() => applyPreset({ ...DEFAULTS, falsePositiveRate: 0 })}>No false alarms</button>
                    </div>
                </div>
                <div className="bayes-visual-rates">
                    <RateControl label="Spam before filtering" value={parameters.prior} onChange={value => updateRate('prior', value)}>
                        {count(spam)} of all 1,000 emails are spam. This changes the starting mix.
                    </RateControl>
                    <RateControl label="Spam caught by the filter" value={parameters.likelihood} onChange={value => updateRate('likelihood', value)}>
                        {count(flaggedSpam)} of the {count(spam)} spam emails get flagged.
                    </RateControl>
                    <RateControl label="Ordinary emails wrongly flagged" value={parameters.falsePositiveRate} onChange={value => updateRate('falsePositiveRate', value)}>
                        {count(flaggedOrdinary)} of the {count(ordinary)} ordinary emails get flagged by mistake.
                    </RateControl>
                </div>
                <div className="bayes-visual-totals">
                    <span>Flagged group: <strong>{count(flaggedSpam)} spam + {count(flaggedOrdinary)} ordinary = {count(flagged)}</strong></span>
                    <span>{has3D ? fractional ? 'Partial tiles show expected fractional emails.' : '1 tile = 1 email.' : 'Area shows email proportions.'} Full explanation in the scene panel.</span>
                </div>
            </div>
        </section>
    </SceneContainer>;
}
