import { useId, useState, type ReactNode } from 'react';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { ExplanationSection, SceneExplanation } from '../../components/layout/SceneExplanation';
import { calculateBayes, type BayesParameters } from '../../utils/bayes';

const POPULATION = 1000;
const DEFAULTS: BayesParameters = { prior: 0.1, likelihood: 0.9, falsePositiveRate: 0.1 };
const count = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });
const percent = (value: number) => {
    const percentage = 100 * value;
    const decimals = (percentage > 0 && percentage < 1) || (percentage > 99 && percentage < 100) ? 2 : 1;
    return `${percentage.toLocaleString('en-US', { maximumFractionDigits: decimals })}%`;
};

interface RateControlProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    children: ReactNode;
}

function RateControl({ label, value, onChange, children }: RateControlProps) {
    const id = useId();
    return <div className="bayes-rate-control">
        <div className="bayes-rate-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{percent(value)}</output></div>
        <input id={id} type="range" min={0} max={100} step={1} value={Math.round(value * 100)}
            aria-describedby={`${id}-help`} onChange={event => onChange(Number(event.target.value) / 100)} />
        <p id={`${id}-help`}>{children}</p>
    </div>;
}

interface FlaggedGroupProps {
    posterior: number;
    spam: number;
    ordinary: number;
}

function FlaggedGroup({ posterior, spam, ordinary }: FlaggedGroupProps) {
    const id = useId();
    return <figure className="bayes-flagged-group">
        <svg viewBox="0 0 600 42" preserveAspectRatio="none" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
            <title id={`${id}-title`}>Composition of the flagged emails</title>
            <desc id={`${id}-desc`}>{count(spam)} flagged emails are spam and {count(ordinary)} are ordinary. Spam makes up {percent(posterior)} of this group.</desc>
            <rect width={600 * posterior} height={42} fill="var(--bayes-spam)" />
            <rect x={600 * posterior} width={600 * (1 - posterior)} height={42} fill="var(--bayes-ordinary)" />
        </svg>
        <figcaption><span className="bayes-spam-text">Spam: {count(spam)}</span><span className="bayes-ordinary-text">Ordinary: {count(ordinary)}</span></figcaption>
    </figure>;
}

export default function BayesTheorem() {
    const id = useId();
    const [parameters, setParameters] = useState<BayesParameters>(DEFAULTS);
    const result = calculateBayes({ ...parameters, population: POPULATION });
    const { eventCount: spam, complementCount: ordinary, eventAndEvidenceCount: flaggedSpam,
        nonEventAndEvidenceCount: flaggedOrdinary, evidenceCount: flagged, evidenceProbability, posteriorProbability: posterior } = result;
    const updateRate = (key: 'prior' | 'likelihood' | 'falsePositiveRate', value: number) =>
        setParameters(current => ({ ...current, [key]: value }));
    const missedSpam = spam - flaggedSpam;
    const unflaggedOrdinary = ordinary - flaggedOrdinary;
    const roundedAnswer = posterior !== null && Number(percent(posterior).slice(0, -1)) / 100 !== posterior;

    const explanation = <SceneExplanation title="Why Bayes' theorem works" summary="After a flag, the group we are asking about changes from all emails to only flagged emails.">
        <ExplanationSection title="Count first, then divide">
            <p>Flagged spam = all emails × chance of spam × chance the filter flags spam.</p>
            <p>Flagged ordinary emails = all emails × chance of an ordinary email × chance the filter wrongly flags it.</p>
            <p>The updated chance is flagged spam divided by the sum of those two counts. Dividing both counts by the total number of emails gives Bayes' formula.</p>
        </ExplanationSection>
        <ExplanationSection title="The formula in symbols">
            <p>A means “the email is spam” and B means “the email is flagged”. The vertical bar | reads “given”: restrict attention to the group after it.</p>
            <p className="bayes-formula">P(A | B) = P(B | A) × P(A) / P(B)</p>
            <p>The denominator includes every way a flag can happen:</p>
            <p className="bayes-formula">P(B) = P(B | A) × P(A) + P(B | not A) × P(not A)</p>
            <p>No independence between spam and flags is assumed. The catch rate and false alarm rate describe how flags depend on the email's true category.</p>
        </ExplanationSection>
        <ExplanationSection title="What the example assumes">
            <p>These are fictional rates for one filter and one email population. We assume those rates are known and apply to the incoming email. The counts are expected averages rather than randomly simulated outcomes; some slider settings produce fractions.</p>
            <p>If the model predicts no flagged emails, P(B) = 0 and the conditional chance given a flag is undefined. It is not a 0% chance of spam.</p>
        </ExplanationSection>
    </SceneExplanation>;

    return <SceneContainer backUrl="/probability" explanation={explanation} defaultPanel="closed">
        <section className="bayes-lesson" aria-labelledby={`${id}-title`}>
            <div className="bayes-content">
                <header className="bayes-header">
                    <p className="bayes-eyebrow">Probability · Learn with a worked example</p>
                    <h1 id={`${id}-title`}>Bayes' theorem</h1>
                    <p className="bayes-question">A filter flags an email. How likely is it to be spam?</p>
                    <p>Bayes' theorem updates a chance when you learn something new. A flag is a clue: the filter can flag spam, but it can also make a mistake on an ordinary email.</p>
                    <p className="bayes-change-summary">Chance of spam: <strong>{percent(parameters.prior)}</strong> before filtering → <strong>{posterior === null ? 'undefined (no flags)' : percent(posterior)}</strong> after a flag. Follow the counts below to see why.</p>
                    <a className="bayes-header-jump" href={`#${id}-inputs`}>Change the numbers ↓</a>
                </header>

                <div className="bayes-layout">
                    <div className="bayes-story">
                        <ol className="bayes-walkthrough">
                            <li className="bayes-step">
                                <h2><span aria-hidden="true">1</span>Start with 1,000 emails</h2>
                                <p>Before using the filter, {percent(parameters.prior)} of the emails are spam. Split the whole group into its two categories:</p>
                                <div className="bayes-pair">
                                    <div className="bayes-count-card bayes-spam-card"><strong>{count(spam)}</strong><span>spam emails</span></div>
                                    <div className="bayes-count-card bayes-ordinary-card"><strong>{count(ordinary)}</strong><span>ordinary emails</span></div>
                                </div>
                                <p>This starting chance of spam is called the <strong>prior</strong>.</p>
                            </li>
                            <li className="bayes-step">
                                <h2><span aria-hidden="true">2</span>Let the filter flag emails</h2>
                                <p>The filter catches {percent(parameters.likelihood)} of spam emails and wrongly flags {percent(parameters.falsePositiveRate)} of ordinary emails. Apply each rate to its own group.</p>
                                <figure className="bayes-flow" aria-label="How the filter splits 1,000 emails">
                                    <div className="bayes-pair">
                                        <div className="bayes-branch">
                                            <p>{count(spam)} spam × {percent(parameters.likelihood)}</p><span className="bayes-arrow" aria-hidden="true">↓</span>
                                            <div className="bayes-count-card bayes-spam-card"><strong>{count(flaggedSpam)}</strong><span>spam emails flagged</span><small>Correct flags</small></div>
                                        </div>
                                        <div className="bayes-branch">
                                            <p>{count(ordinary)} ordinary × {percent(parameters.falsePositiveRate)}</p><span className="bayes-arrow" aria-hidden="true">↓</span>
                                            <div className="bayes-count-card bayes-ordinary-card"><strong>{count(flaggedOrdinary)}</strong><span>ordinary emails flagged</span><small>False alarms</small></div>
                                        </div>
                                    </div>
                                    <figcaption>Both kinds of flag enter the group we will look at next.</figcaption>
                                </figure>
                                <p className="bayes-aside">The remaining {count(missedSpam)} spam and {count(unflaggedOrdinary)} ordinary emails were not flagged. Leave them out when asking about a flagged email.</p>
                            </li>
                            <li className="bayes-step bayes-answer-step">
                                <h2><span aria-hidden="true">3</span>Look only at the flagged emails</h2>
                                <p>{count(flaggedSpam)} spam + {count(flaggedOrdinary)} ordinary = <strong>{count(flagged)} flagged emails</strong>.</p>
                                {posterior !== null ? <>
                                    <FlaggedGroup posterior={posterior} spam={flaggedSpam} ordinary={flaggedOrdinary} />
                                    <p>Of those {count(flagged)} flagged emails, {count(flaggedSpam)} are spam. Divide the spam count by the size of this smaller group:</p>
                                    <div className="bayes-answer" aria-live="polite">
                                        <span>{count(flaggedSpam)} ÷ {count(flagged)} {roundedAnswer ? '≈' : '='} </span>
                                        <output aria-label="Chance of spam after a flag">{percent(posterior)}</output>
                                    </div>
                                    <p>The chance of spam after a flag is {percent(posterior)}. This updated chance is called the <strong>posterior</strong>.</p>
                                    {roundedAnswer && <p className="bayes-aside">≈ means “approximately”: the displayed percentage is rounded.</p>}
                                </> : <div className="bayes-empty" role="status">
                                    <output aria-label="Chance of spam after a flag">Undefined — no flagged emails</output>
                                    <p>There is no flagged group to choose from, so we cannot divide by its size. Increase a flagging rate to create one.</p>
                                </div>}
                            </li>
                        </ol>

                        <section className="bayes-insight" aria-labelledby={`${id}-insight`}>
                            <h2 id={`${id}-insight`}>These chances answer different questions</h2>
                            <p><strong>{percent(parameters.likelihood)} asks: “Among spam emails, how many get flagged?”</strong></p>
                            <p>We asked the reverse: “Among flagged emails, how many are spam?” That group includes false alarms. The two questions use different totals, so their answers need not match.</p>
                            <p>Try <strong>Reset example</strong>: the filter catches 90% of spam, but only 50% of its flags are spam. Try <strong>Rare spam</strong>: false alarms then outnumber caught spam.</p>
                        </section>
                    </div>

                    <aside id={`${id}-inputs`} className="bayes-controls" aria-labelledby={`${id}-controls`}>
                        <h2 id={`${id}-controls`}>Change the example</h2>
                        <p>Move one slider at a time. Watch which counts change and who ends up in the flagged group.</p>
                        <RateControl label="Spam before filtering" value={parameters.prior} onChange={value => updateRate('prior', value)}>
                            {count(spam)} of all 1,000 emails are spam. This changes the starting mix.
                        </RateControl>
                        <RateControl label="Spam caught by the filter" value={parameters.likelihood} onChange={value => updateRate('likelihood', value)}>
                            {count(flaggedSpam)} of the {count(spam)} spam emails get flagged.
                        </RateControl>
                        <RateControl label="Ordinary emails wrongly flagged" value={parameters.falsePositiveRate} onChange={value => updateRate('falsePositiveRate', value)}>
                            {count(flaggedOrdinary)} of the {count(ordinary)} ordinary emails get flagged by mistake.
                        </RateControl>
                        <div className="bayes-presets">
                            <button type="button" className="lab-button" onClick={() => setParameters(DEFAULTS)}>Reset example</button>
                            <button type="button" className="lab-button" onClick={() => setParameters({ ...DEFAULTS, prior: 0.01 })}>Rare spam</button>
                            <button type="button" className="lab-button" onClick={() => setParameters({ ...DEFAULTS, falsePositiveRate: 0 })}>No false alarms</button>
                        </div>
                        <p className="bayes-experiment-hint"><strong>Try this:</strong> after Rare spam, reduce false alarms from 10% to 1%. The filter's catch rate stays 90%, but a flag becomes much more convincing.</p>
                        <p className="bayes-aside">Fictional rates, used to learn the rule. Counts are expected averages; some settings give fractions.</p>
                    </aside>
                </div>

                <section className="bayes-symbols" aria-labelledby={`${id}-symbols`}>
                    <h2 id={`${id}-symbols`}>Connect the story to the formula</h2>
                    <p>Let <strong>A</strong> mean “the email is spam” and <strong>B</strong> mean “the filter flags it”. <strong>P</strong> means probability, or chance. The bar <strong>|</strong> reads “given”: focus only on the group after it.</p>
                    <p className="bayes-formula">P(A | B) = P(B | A) × P(A) / P(B)</p>
                    <p>In words: <strong>chance of spam after a flag = chance of a flag on spam × starting chance of spam ÷ chance of any flag.</strong></p>
                    <dl className="bayes-glossary">
                        <div><dt>Prior · P(A)</dt><dd>{percent(parameters.prior)} — chance of spam before seeing the flag.</dd></div>
                        <div><dt>Likelihood · P(B | A)</dt><dd>{percent(parameters.likelihood)} — chance the filter flags an email, given it is spam.</dd></div>
                        <div><dt>Evidence probability · P(B)</dt><dd>{percent(evidenceProbability)} — chance any email is flagged, including false alarms. It is calculated from both groups.</dd></div>
                        <div><dt>Posterior · P(A | B)</dt><dd>{posterior === null ? 'Undefined with no flags' : percent(posterior)} — chance an email is spam, given it was flagged.</dd></div>
                    </dl>
                    <p className="bayes-aside">“Evidence” here is the observed flag. P(B) is how often that flag occurs across all emails; it is not another freely chosen slider.</p>
                </section>
            </div>
        </section>
    </SceneContainer>;
}
