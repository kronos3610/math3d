import { useId, useRef, useState, type ReactNode } from 'react';

interface PredictPromptProps {
    question: string;
    options: readonly string[];
    correct: number;
    explanation: ReactNode;
    onReveal?: () => void;
    contextKey?: string;
    persistenceKey?: string;
}

function savedDismissal(key?: string): boolean {
    try { return Boolean(key && window.localStorage.getItem(`math3d-predict-${key}`) === 'dismissed'); }
    catch { return false; }
}

/** Each context is a new prediction; scene parameters can never leave stale feedback behind. */
export function PredictPrompt(props: PredictPromptProps) {
    return <Prediction key={props.contextKey ?? props.question} {...props} />;
}

function Prediction({ question, options, correct, explanation, onReveal, persistenceKey }: PredictPromptProps) {
    const id = useId();
    const feedback = useRef<HTMLDivElement>(null);
    const [answer, setAnswer] = useState<number | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [hidden, setHidden] = useState(() => savedDismissal(persistenceKey));
    const [remember, setRemember] = useState(false);
    function reveal(skip: boolean) {
        if (remember && persistenceKey) {
            try { window.localStorage.setItem(`math3d-predict-${persistenceKey}`, 'dismissed'); } catch { /* private browsing */ }
        }
        setRevealed(true);
        if (skip) setAnswer(null);
        onReveal?.();
        // Run after React commits the feedback, including when motion is globally paused.
        window.setTimeout(() => feedback.current?.focus(), 0);
    }
    if (hidden) return <div className="lab-control-row"><button type="button" className="lab-button predict-show" onClick={() => setHidden(false)}>Try a prediction</button>
        <button type="button" className="lab-button" onClick={() => { setHidden(false); reveal(true); }}>Reveal result</button></div>;
    return <section className="predict-prompt" aria-labelledby={`${id}-question`}>
        <h2 id={`${id}-question`}>{question}</h2>
        {!revealed && <>
            <fieldset className="predict-options"><legend className="sr-only">Choose your prediction</legend>
                {options.map((option, index) => <label key={`${index}-${option}`}><input type="radio" name={id} checked={answer === index}
                    onChange={() => setAnswer(index)} />{option}</label>)}
            </fieldset>
            <div className="lab-control-row">
                <button type="button" className="lab-button" disabled={answer === null} onClick={() => reveal(false)}>Lock in</button>
                <button type="button" className="lab-button" onClick={() => reveal(true)}>Skip prediction</button>
                {persistenceKey && <label className="lab-checkbox"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Don’t ask again</label>}
            </div>
        </>}
        <div ref={feedback} tabIndex={-1} role="status" aria-live="polite" className="predict-feedback">
            {revealed && <>{answer !== null && <strong>{answer === correct ? 'Your prediction matches. ' : `The result is ${options[correct]}. `}</strong>}{explanation}
                <button type="button" className="lab-button" onClick={() => { setRevealed(false); setAnswer(null); }}>Predict again</button>
            </>}
        </div>
    </section>;
}
