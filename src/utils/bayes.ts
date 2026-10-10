export interface BayesParameters {
    /** P(event), before observing the evidence. */
    prior: number;
    /** P(evidence | event), also called the true-positive rate. */
    likelihood: number;
    /** P(evidence | not event). */
    falsePositiveRate: number;
    population?: number;
}

export interface BayesResult {
    eventCount: number;
    complementCount: number;
    eventAndEvidenceCount: number;
    nonEventAndEvidenceCount: number;
    evidenceCount: number;
    evidenceProbability: number;
    posteriorProbability: number | null;
}

function validateProbability(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(`${name} must be a finite probability between 0 and 1.`);
    }
}

/**
 * Expected frequencies, without rounding, for Bayes' rule and total probability.
 * The posterior is undefined when the specified model assigns zero probability
 * to the evidence; a null result must not be displayed as a zero posterior.
 */
export function calculateBayes({ prior, likelihood, falsePositiveRate, population = 1000 }: BayesParameters): BayesResult {
    validateProbability(prior, 'Prior');
    validateProbability(likelihood, 'Likelihood');
    validateProbability(falsePositiveRate, 'False-positive rate');
    if (!Number.isFinite(population) || population <= 0) {
        throw new RangeError('Population must be finite and positive.');
    }

    const eventAndEvidenceProbability = prior * likelihood;
    const nonEventAndEvidenceProbability = (1 - prior) * falsePositiveRate;
    const evidenceProbability = eventAndEvidenceProbability + nonEventAndEvidenceProbability;

    return {
        eventCount: population * prior,
        complementCount: population * (1 - prior),
        eventAndEvidenceCount: population * eventAndEvidenceProbability,
        nonEventAndEvidenceCount: population * nonEventAndEvidenceProbability,
        evidenceCount: population * evidenceProbability,
        evidenceProbability,
        // Use probabilities rather than rounded frequencies. Changing the displayed
        // population cannot change the posterior or amplify count underflow.
        posteriorProbability: evidenceProbability === 0 ? null : eventAndEvidenceProbability / evidenceProbability,
    };
}
