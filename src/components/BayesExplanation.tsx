import { ExplanationSection, SceneExplanation } from './layout/SceneExplanation';
import { type BayesParameters, type BayesResult } from '../utils/bayes';
import { formatBayesCount as count, formatBayesPercent as percent, isBayesPercentRounded } from '../utils/bayes-format';

interface BayesExplanationProps {
    parameters: BayesParameters;
    result: BayesResult;
}

export default function BayesExplanation({ parameters, result }: BayesExplanationProps) {
    const {
        eventCount: spam,
        complementCount: ordinary,
        eventAndEvidenceCount: flaggedSpam,
        nonEventAndEvidenceCount: flaggedOrdinary,
        evidenceCount: flagged,
        evidenceProbability,
        posteriorProbability: posterior,
    } = result;
    const population = spam + ordinary;
    const roundedAnswer = posterior !== null && isBayesPercentRounded(posterior);

    return (
        <SceneExplanation
            title="Why Bayes' theorem works"
            summary="A filter flags an email. How likely is it to be spam? Follow the counts: after a flag, we look only at the flagged group."
        >
            <ExplanationSection title={`1. Start with ${count(population)} emails`}>
                <p>Before filtering, {percent(parameters.prior)} of the emails are spam. Split the whole group into two categories:</p>
                <div className="bayes-pair">
                    <div className="bayes-count-card bayes-spam-card"><strong>{count(spam)}</strong><span>spam emails</span></div>
                    <div className="bayes-count-card bayes-ordinary-card"><strong>{count(ordinary)}</strong><span>ordinary emails</span></div>
                </div>
                <p>This starting chance of spam is called the <strong>prior</strong>.</p>
            </ExplanationSection>

            <ExplanationSection title="2. Let the filter flag emails">
                <p>The filter catches {percent(parameters.likelihood)} of spam emails and wrongly flags {percent(parameters.falsePositiveRate)} of ordinary emails. Apply each rate to its own group.</p>
                <figure className="bayes-flow" aria-label={`How the filter splits ${count(population)} emails`}>
                    <div className="bayes-pair">
                        <div className="bayes-branch">
                            <p>{count(spam)} spam × {percent(parameters.likelihood)}</p>
                            <span className="bayes-arrow" aria-hidden="true">↓</span>
                            <div className="bayes-count-card bayes-spam-card"><strong>{count(flaggedSpam)}</strong><span>spam emails flagged</span><small>Correct flags</small></div>
                        </div>
                        <div className="bayes-branch">
                            <p>{count(ordinary)} ordinary × {percent(parameters.falsePositiveRate)}</p>
                            <span className="bayes-arrow" aria-hidden="true">↓</span>
                            <div className="bayes-count-card bayes-ordinary-card"><strong>{count(flaggedOrdinary)}</strong><span>ordinary emails flagged</span><small>False alarms</small></div>
                        </div>
                    </div>
                    <figcaption>Both kinds of flag enter the group we will look at next.</figcaption>
                </figure>
                <p>The remaining {count(spam - flaggedSpam)} spam and {count(ordinary - flaggedOrdinary)} ordinary emails were not flagged. Leave them out when asking about a flagged email.</p>
            </ExplanationSection>

            <ExplanationSection title="3. Look only at the flagged emails">
                <p>{count(flaggedSpam)} spam + {count(flaggedOrdinary)} ordinary = <strong>{count(flagged)} flagged emails</strong>.</p>
                {posterior !== null ? (
                    <>
                        <p>Of those {count(flagged)} flagged emails, {count(flaggedSpam)} are spam. Divide the spam count by the size of this smaller group:</p>
                        <p className="bayes-answer">
                            {count(flaggedSpam)} ÷ {count(flagged)} {roundedAnswer ? '≈' : '='}{' '}
                            <output aria-label="Worked-example chance of spam after a flag">{percent(posterior)}</output>
                        </p>
                        <p>The chance of spam after a flag is {percent(posterior)}. This updated chance is called the <strong>posterior</strong>.</p>
                        {roundedAnswer && <p>≈ means “approximately”: the displayed percentage is rounded.</p>}
                    </>
                ) : (
                    <p>There are no flagged emails, so we cannot divide by the size of that group. The chance of spam given a flag is <strong>undefined</strong>, rather than 0%.</p>
                )}
            </ExplanationSection>

            <ExplanationSection title="These chances answer different questions">
                <p><strong>{percent(parameters.likelihood)} asks: “Among spam emails, how many get flagged?”</strong></p>
                <p>We asked the reverse: “Among flagged emails, how many are spam?” The flagged group can include false alarms. The two questions use different totals, so their answers need not match.</p>
                <p>Try <strong>Reset example</strong>: the filter catches 90% of spam, but only 50% of its flags are spam. With <strong>Rare spam</strong>, false alarms outnumber caught spam.</p>
                <p>After Rare spam, reduce false alarms from 10% to 1%. The catch rate stays 90%, but a flag becomes more convincing. <strong>No false alarms</strong> removes wrongly flagged ordinary emails; missed spam still stays outside the flagged group.</p>
            </ExplanationSection>

            <ExplanationSection title="Connect the story to the formula">
                <p><strong>A</strong> means “the email is spam” and <strong>B</strong> means “the email is flagged”. <strong>P</strong> means probability, or chance. The bar <strong>|</strong> reads “given”: focus only on the group after it.</p>
                <p className="bayes-formula">P(A | B) = P(B | A) × P(A) / P(B)</p>
                <p>In words: <strong>chance of spam after a flag = chance of a flag on spam × starting chance of spam ÷ chance of any flag.</strong></p>
                <dl className="bayes-glossary">
                    <div><dt>Prior · P(A)</dt><dd>{percent(parameters.prior)} — chance of spam before seeing a flag.</dd></div>
                    <div><dt>Likelihood · P(B | A)</dt><dd>{percent(parameters.likelihood)} — chance the filter flags an email, given it is spam.</dd></div>
                    <div><dt>Evidence probability · P(B)</dt><dd>{percent(evidenceProbability)} — chance any email is flagged, including false alarms. It is calculated from both groups.</dd></div>
                    <div><dt>Posterior · P(A | B)</dt><dd>{posterior === null ? 'Undefined with no flags' : percent(posterior)} — chance an email is spam, given it was flagged.</dd></div>
                </dl>
                <p>“Evidence” here is the observed flag. P(B) is how often that flag occurs across all emails; it is calculated rather than chosen independently.</p>
            </ExplanationSection>

            <ExplanationSection title="Where the denominator comes from">
                <p>Flagged spam = all emails × chance of spam × chance the filter flags spam.</p>
                <p>Flagged ordinary emails = all emails × chance of an ordinary email × chance the filter wrongly flags it.</p>
                <p>Add both counts to include every way a flag can happen. Dividing by the population gives:</p>
                <p className="bayes-formula">P(B) = P(B | A) × P(A) + P(B | not A) × P(not A)</p>
                <p>No independence between spam and flags is assumed. The catch rate and false alarm rate describe how flags depend on the true category.</p>
            </ExplanationSection>

            <ExplanationSection title="What the example assumes">
                <p>These are fictional rates for one filter and one email population. We assume the rates are known and apply to the incoming email. The counts are expected averages rather than randomly simulated outcomes; some slider settings produce fractions.</p>
                <p>If the model predicts no flagged emails, P(B) = 0 and the chance given a flag is undefined. A hypothetical flag in that situation has no probability under this model.</p>
            </ExplanationSection>
        </SceneExplanation>
    );
}
