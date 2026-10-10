import { useId } from 'react';
import type { BayesParameters, BayesResult } from '../utils/bayes';
import { formatBayesCount as count } from '../utils/bayes-format';

interface BayesPopulationFallbackProps {
    parameters: BayesParameters;
    result: BayesResult;
    view: 'population' | 'flags' | 'conditional';
}

/** Preserve a visual probability model when a device cannot create a WebGL2 view. */
export default function BayesPopulationFallback({ parameters, result, view }: BayesPopulationFallbackProps) {
    const id = useId();
    const left = 32;
    const top = 48;
    const side = 300;
    const spamWidth = side * parameters.prior;
    const ordinaryWidth = side - spamWidth;
    const posterior = result.posteriorProbability;
    const conditional = view === 'conditional';
    const unflaggedOpacity = view === 'population' ? 1 : 0.2;
    return <figure className="bayes-visual-fallback">
        <div className="bayes-fallback-labels"><span>Original population · 1,000</span>{conditional && <span>Flagged · {count(result.evidenceCount)}</span>}</div>
        <svg viewBox={conditional ? '0 0 700 400' : '0 0 364 400'} role="img" aria-labelledby={`${id}-title ${id}-description`}>
            <title id={`${id}-title`}>Bayes email groups in a 2D probability diagram</title>
            <desc id={`${id}-description`}>Gold represents spam and blue represents ordinary emails. The population square contains all 1,000 emails, with each flagging rate applied within its own category. {conditional ? `The enlarged right square contains only the ${count(result.evidenceCount)} flagged emails: ${count(result.eventAndEvidenceCount)} spam and ${count(result.nonEventAndEvidenceCount)} ordinary.` : view === 'flags' ? 'The bright areas show flagged emails; unflagged areas are dim.' : 'The two colors show the starting proportions before filtering.'}</desc>
            <rect x={left} y={top} width={spamWidth} height={side * parameters.likelihood} fill="var(--bayes-spam)" />
            <rect x={left} y={top + side * parameters.likelihood} width={spamWidth} height={side * (1 - parameters.likelihood)} fill="var(--bayes-spam)" opacity={unflaggedOpacity} />
            <rect x={left + spamWidth} y={top} width={ordinaryWidth} height={side * parameters.falsePositiveRate} fill="var(--bayes-ordinary)" />
            <rect x={left + spamWidth} y={top + side * parameters.falsePositiveRate} width={ordinaryWidth} height={side * (1 - parameters.falsePositiveRate)} fill="var(--bayes-ordinary)" opacity={unflaggedOpacity} />
            <rect x={left} y={top} width={side} height={side} fill="none" stroke="var(--border-glass-hover)" />
            {conditional && <path d="M343 198h20m-7-6 7 6-7 6" fill="none" stroke="var(--text-secondary)" strokeWidth={2} />}
            {conditional && posterior !== null && <g>
                <rect x={368} y={top} width={side * posterior} height={side} fill="var(--bayes-spam)" />
                <rect x={368 + side * posterior} y={top} width={side * (1 - posterior)} height={side} fill="var(--bayes-ordinary)" />
            </g>}
            {conditional && <rect x={368} y={top} width={side} height={side} fill="none" stroke="var(--border-glass-hover)" />}
        </svg>
        <figcaption>2D view · area shows email proportions{conditional ? '; the flagged group is enlarged.' : '.'}</figcaption>
    </figure>;
}
