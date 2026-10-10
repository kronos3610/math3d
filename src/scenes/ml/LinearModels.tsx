import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import Latex from '../../components/Latex';
import { SceneContainer } from '../../components/layout/SceneContainer';
import {
    classificationRegion, decisionBoundary, exampleClassificationPoints, fitLinearClassifier,
    linearScore, predictClass, sigmoid,
} from '../../utils/linear-models';
import type { BinaryClass, ClassificationPoint, LinearAlgorithm, PlotPoint } from '../../utils/linear-models';

interface ModelBriefing {
    title: string;
    purpose: string;
    output: string;
    rule: string;
    formula: string;
    experiment: string;
}

const BRIEFINGS: Record<LinearAlgorithm, ModelBriefing> = {
    logistic: {
        title: 'Logistic regression',
        purpose: 'Binary classification: estimate the probability that an observation belongs to blue class C₁.',
        output: 'The sigmoid turns a linear score into a model probability between 0 and 1.',
        rule: 'Predict blue C₁ when p(C₁ | x) ≥ 0.5. The white line marks p = 0.5.',
        formula: 'p(C_1\\mid\\mathbf{x}) = \\sigma(w_0 + w_1x_1 + w_2x_2)',
        experiment: 'Move the cursor away from the white line and watch its probability approach 0 or 1. Add overlapping classes to make confidence less decisive.',
    },
    'least-squares': {
        title: 'Least squares classification',
        purpose: 'Linear regression fitted to binary targets: blue C₁ = 1 and red C₂ = 0.',
        output: 'The raw prediction is a numeric score. It can fall below 0 or above 1 and is not a calibrated probability.',
        rule: 'For this classification experiment, predict blue C₁ when the score ≥ 0.5. The white line marks score = 0.5.',
        formula: '\\hat{t}(\\mathbf{x}) = w_0 + w_1x_1 + w_2x_2,\\quad \\hat{t}\\geq 0.5 \\Rightarrow C_1',
        experiment: 'Add a blue point far inside the red region, then switch to logistic regression using the same data. Compare how the boundary changes.',
    },
    perceptron: {
        title: 'Perceptron',
        purpose: 'Binary classification using mistake-driven updates to a linear score.',
        output: 'The sign of the score selects a class; the score is not a probability.',
        rule: 'Predict blue C₁ when the score ≥ 0. The white line marks score = 0.',
        formula: 'a(\\mathbf{x}) = w_0 + w_1x_1 + w_2x_2,\\quad a\\geq 0 \\Rightarrow C_1',
        experiment: 'First separate the two classes, then add conflicting points at the same location. A perceptron cannot converge on data with no linear separator.',
    },
};

const PLOT = { width: 800, height: 440, left: 88, right: 774, top: 20, bottom: 395 };
const toX = (x: number) => PLOT.left + (x + 1) * (PLOT.right - PLOT.left) / 2;
const toY = (y: number) => PLOT.bottom - (y + 1) * (PLOT.bottom - PLOT.top) / 2;
const clamp = (value: number) => Math.abs(value) < 1e-12 ? 0 : Math.max(-1, Math.min(1, value));

export default function LinearModels() {
    const id = useId();
    const [points, setPoints] = useState<ClassificationPoint[]>(() => exampleClassificationPoints(3610));
    const [algorithm, setAlgorithm] = useState<LinearAlgorithm>('logistic');
    const [currentClass, setCurrentClass] = useState<BinaryClass>(1);
    const [cursor, setCursor] = useState<PlotPoint>({ x1: 0, x2: 0 });
    const [exampleSeed, setExampleSeed] = useState(3610);
    const fit = useMemo(() => fitLinearClassifier(points, algorithm), [points, algorithm]);
    const briefing = BRIEFINGS[algorithm];
    const hasBothClasses = points.some(point => point.target === 1) && points.some(point => point.target === 0);
    const blueRegion = useMemo(() => classificationRegion(fit.weights, algorithm, 1), [fit.weights, algorithm]);
    const redRegion = useMemo(() => classificationRegion(fit.weights, algorithm, 0), [fit.weights, algorithm]);
    const boundary = useMemo(() => decisionBoundary(fit.weights, algorithm), [fit.weights, algorithm]);
    const correct = points.filter(point => predictClass(fit.weights, algorithm, point) === point.target).length;
    const blueCount = points.filter(point => point.target === 1).length;
    const score = linearScore(fit.weights, cursor);
    const cursorClass = predictClass(fit.weights, algorithm, cursor);
    const prediction = algorithm === 'logistic'
        ? 'p(C₁ | x) = ' + sigmoid(score).toFixed(3)
        : (algorithm === 'least-squares' ? 'Raw numeric score' : 'Signed score') + ' = ' + score.toFixed(3);

    const addPoint = (point: PlotPoint) => setPoints(current => [...current, { ...point, target: currentClass }]);
    const handlePlotClick = (event: MouseEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const transform = event.currentTarget.getScreenCTM?.();
        const mapped = transform?.inverse().transformPoint({ x: event.clientX, y: event.clientY });
        const x = mapped?.x ?? (event.clientX - rect.left) * PLOT.width / rect.width;
        const y = mapped?.y ?? (event.clientY - rect.top) * PLOT.height / rect.height;
        if (x < PLOT.left || x > PLOT.right || y < PLOT.top || y > PLOT.bottom) return;
        const point = {
            x1: clamp((x - PLOT.left) / (PLOT.right - PLOT.left) * 2 - 1),
            x2: clamp(1 - (y - PLOT.top) / (PLOT.bottom - PLOT.top) * 2),
        };
        setCursor(point);
        addPoint(point);
        event.currentTarget.focus();
    };
    const handlePlotKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
        const step = event.shiftKey ? 0.02 : 0.1;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            addPoint(cursor);
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) {
            event.preventDefault();
            setCursor(current => event.key === 'Home' ? { x1: 0, x2: 0 } : {
                x1: clamp(current.x1 + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)),
                x2: clamp(current.x2 + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0)),
            });
        }
    };

    const explanation = (
        <div className="linear-models-explanation">
            <h3>{briefing.title}</h3>
            <p>{briefing.purpose}</p>
            <p>{briefing.output}</p>
            <p>{briefing.rule}</p>
            <Latex formula={briefing.formula} />
            <h3>Linear regression versus logistic regression</h3>
            <p>Linear regression normally predicts a numeric target, such as a price or temperature. Logistic regression predicts a binary class probability. Both use a linear combination of the input features, but their outputs and training objectives differ.</p>
            <p>The least squares option here applies linear regression to labels 0 and 1, then adds a 0.5 classification threshold. This is a classification comparison; the plot’s vertical axis is input feature x₂, rather than a continuous regression target.</p>
            <h3>What the plot means</h3>
            <p>Each point contains two features, x₁ and x₂, and a known class label. Blue circles are C₁; red triangles are C₂. The faint background shows the predicted class, and the white line separates the two predictions.</p>
            <p>The three coefficients determine the line: w₀ is its intercept term, while w₁ and w₂ weight the two features. The intercept is sometimes called a bias parameter; this differs from statistical bias in the bias–variance tradeoff.</p>
            <h3>Try this</h3>
            <p>{briefing.experiment}</p>
            <p>Switch algorithms without clearing the data to make a fair visual comparison. Training accuracy only describes these entered points; it does not estimate performance on unseen data.</p>
            <p>Least squares uses a small ridge penalty of 0.01 on its three coefficients. Logistic regression minimizes binary cross-entropy with small L2 penalties (0.001 on the intercept and 0.05 on the feature weights) to keep separable examples finite. Perceptron training stops after at most 1,000 passes and reports if it fails to converge.</p>
        </div>
    );

    return (
        <SceneContainer backUrl="/ml" explanation={explanation} defaultPanel="closed">
            <section className="linear-models-lab" aria-labelledby={id + '-title'}>
                <div className="linear-models-content">
                    <header className="linear-models-header">
                        <p className="linear-models-eyebrow">Algorithms · Binary classification lab</p>
                        <h1 id={id + '-title'}>Linear Models for Classification</h1>
                        <p>Compare logistic regression, least squares, and the perceptron on the same two-feature dataset.</p>
                    </header>
                    <p className="linear-models-current">{briefing.title} · {briefing.rule}</p>
                    <svg className="linear-models-plot" viewBox={'0 0 ' + PLOT.width + ' ' + PLOT.height} preserveAspectRatio="xMidYMid meet"
                        role="application" aria-label="Interactive classification plot" aria-describedby={id + '-plot-description ' + id + '-keyboard'}
                        tabIndex={0} onClick={handlePlotClick} onKeyDown={handlePlotKeyDown}>
                        <desc id={id + '-plot-description'}>A two-feature classification plot using {briefing.title}. There are {blueCount} blue circles labeled C₁ and {points.length - blueCount} red triangles labeled C₂. Faint colored regions show predictions; the white line marks the decision threshold. The gold cursor can place a new training point.</desc>
                        <g aria-hidden="true">
                            <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="var(--bg-secondary)" />
                            {hasBothClasses && <>
                                <polygon points={blueRegion.map(point => toX(point.x1) + ',' + toY(point.x2)).join(' ')} fill="var(--linear-class-blue)" opacity={0.12} />
                                <polygon points={redRegion.map(point => toX(point.x1) + ',' + toY(point.x2)).join(' ')} fill="var(--linear-class-red)" opacity={0.12} />
                            </>}
                            {[-1, -0.5, 0, 0.5, 1].map(value => <g key={value}>
                                <line x1={toX(value)} x2={toX(value)} y1={PLOT.top} y2={PLOT.bottom} stroke="var(--border-glass-hover)" />
                                <line x1={PLOT.left} x2={PLOT.right} y1={toY(value)} y2={toY(value)} stroke="var(--border-glass-hover)" />
                                <text x={toX(value)} y={PLOT.bottom + 21} textAnchor="middle">{value}</text>
                                <text x={PLOT.left - 12} y={toY(value) + 4} textAnchor="end">{value}</text>
                            </g>)}
                            {hasBothClasses && boundary && <line x1={toX(boundary[0].x1)} y1={toY(boundary[0].x2)} x2={toX(boundary[1].x1)} y2={toY(boundary[1].x2)} stroke="var(--text-primary)" strokeWidth={2.5} />}
                            {points.map((point, index) => point.target === 1
                                ? <circle key={index} cx={toX(point.x1)} cy={toY(point.x2)} r={6} fill="var(--linear-class-blue)" stroke="var(--text-primary)" strokeWidth={1} />
                                : <polygon key={index} points={toX(point.x1) + ',' + (toY(point.x2) - 7) + ' ' + (toX(point.x1) - 6.5) + ',' + (toY(point.x2) + 5) + ' ' + (toX(point.x1) + 6.5) + ',' + (toY(point.x2) + 5)} fill="var(--linear-class-red)" stroke="var(--text-primary)" strokeWidth={1} />)}
                            <g className="linear-models-cursor">
                                <circle cx={toX(cursor.x1)} cy={toY(cursor.x2)} r={10} fill="none" stroke="var(--color-ml)" strokeWidth={2} strokeDasharray="3 2" />
                                <line x1={toX(cursor.x1) - 14} x2={toX(cursor.x1) + 14} y1={toY(cursor.x2)} y2={toY(cursor.x2)} stroke="var(--color-ml)" />
                                <line x1={toX(cursor.x1)} x2={toX(cursor.x1)} y1={toY(cursor.x2) - 14} y2={toY(cursor.x2) + 14} stroke="var(--color-ml)" />
                            </g>
                            <text x={(PLOT.left + PLOT.right) / 2} y={PLOT.height - 5} textAnchor="middle">Input feature x₁</text>
                            <text transform={'translate(16 ' + (PLOT.top + PLOT.bottom) / 2 + ') rotate(-90)'} textAnchor="middle">Input feature x₂</text>
                            {points.length === 0 && <text x={PLOT.width / 2} y={PLOT.height / 2} textAnchor="middle">Add blue and red training points to begin</text>}
                        </g>
                    </svg>

                    <div className="linear-models-legend" aria-label="Plot legend">
                        <span className="linear-models-blue">● Blue C₁: target 1</span>
                        <span className="linear-models-red">▲ Red C₂: target 0</span>
                        <span>━ White: decision boundary</span>
                        <span>Faint regions: predicted class</span>
                        <span>⊕ Gold: keyboard cursor</span>
                    </div>

                    <div className="linear-models-controls">
                        <div className="linear-models-field">
                            <label htmlFor={id + '-algorithm'}>Learning algorithm</label>
                            <select id={id + '-algorithm'} value={algorithm}
                                onChange={event => setAlgorithm(event.target.value as LinearAlgorithm)}>
                                <option value="logistic">Logistic regression</option>
                                <option value="least-squares">Least squares: linear regression on 0/1</option>
                                <option value="perceptron">Perceptron</option>
                            </select>
                        </div>
                        <fieldset className="linear-models-class-choice">
                            <legend>Class for new points</legend>
                            <button type="button" className="linear-models-class-button linear-models-blue" aria-pressed={currentClass === 1}
                                onClick={() => setCurrentClass(1)}>● Blue class C₁ (target 1)</button>
                            <button type="button" className="linear-models-class-button linear-models-red" aria-pressed={currentClass === 0}
                                onClick={() => setCurrentClass(0)}>▲ Red class C₂ (target 0)</button>
                        </fieldset>
                        <div className="linear-models-actions">
                            <button type="button" className="lab-button" onClick={() => {
                                const nextSeed = exampleSeed + 1;
                                setExampleSeed(nextSeed);
                                setPoints(exampleClassificationPoints(nextSeed));
                            }}>New example</button>
                            <button type="button" className="lab-button" onClick={() => setPoints([])}>Clear points</button>
                        </div>
                    </div>

                    <section className="linear-models-briefing" aria-labelledby={id + '-model-heading'}>
                        <h2 id={id + '-model-heading'}>Selected model: {briefing.title}</h2>
                        <p>{briefing.purpose} {briefing.output}</p>
                        <p className="linear-models-rule">{briefing.rule}</p>
                        <p className="linear-models-regression-note">Linear regression usually predicts a numeric target. Here, the least squares option fits numeric values to class labels 0 and 1, then classifies them at 0.5.</p>
                    </section>

                    <ol className="linear-models-steps" aria-label="How to use this lab">
                        <li>Choose a learning algorithm.</li>
                        <li>Select blue or red, then click or tap the plot to add training points.</li>
                        <li>Switch algorithms using the same points; compare the white boundary and cursor prediction.</li>
                    </ol>
                    <p id={id + '-keyboard'} className="linear-models-keyboard-help">Keyboard: focus the plot, use arrow keys to move the cursor, and press Enter or Space to add the selected class. Hold Shift for smaller steps; Home returns to the origin.</p>

                    {!hasBothClasses && <p className="linear-models-status" role="status">Add at least one point from each class to compare a decision boundary.</p>}
                    {hasBothClasses && !fit.converged && <p className="linear-models-status" role="status">{algorithm === 'perceptron' ? 'Perceptron did not converge after 1,000 passes. Overlapping or conflicting classes can have no linear separator.' : 'The numerical fit reached its iteration limit. Try a different arrangement of training points.'}</p>}

                    <div className="linear-models-cursor-readout" aria-live="polite">
                        <p>Cursor: x₁ = {cursor.x1.toFixed(2)}, x₂ = {cursor.x2.toFixed(2)}. {hasBothClasses ? prediction + '; predicted ' + (cursorClass === 1 ? 'blue C₁' : 'red C₂') + '.' : 'Add both classes to inspect predictions.'}</p>
                        <button type="button" className="lab-button" onClick={() => addPoint(cursor)}>Add point at cursor</button>
                    </div>
                    <dl className="linear-models-metrics" aria-label="Training dataset and model coefficients">
                        <div><dt>Training points</dt><dd>{points.length} ({blueCount} blue, {points.length - blueCount} red)</dd></div>
                        <div><dt>Training accuracy</dt><dd>{hasBothClasses ? (100 * correct / points.length).toFixed(1) + '%' : 'Needs both classes'}</dd></div>
                        <div><dt>Intercept w₀</dt><dd>{fit.weights[0].toFixed(3)}</dd></div>
                        <div><dt>Feature weight w₁</dt><dd>{fit.weights[1].toFixed(3)}</dd></div>
                        <div><dt>Feature weight w₂</dt><dd>{fit.weights[2].toFixed(3)}</dd></div>
                    </dl>
                    <p className="linear-models-footnote">The two axes are input features, not the predicted target. Training accuracy measures only these points. Open Explain for the current model’s formula and a suggested experiment.</p>
                </div>
            </section>
        </SceneContainer>
    );
}
