import { useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// --- Types ---

interface DataPoint {
    x: number;
    c: number; // class index: 0, 1, or 2
}

// --- Constants ---

const INITIAL_POINTS: DataPoint[] = [
    { x: 2, c: 0 }, { x: 3, c: 0 }, { x: 4, c: 0 },
    { x: 8, c: 1 }, { x: 9, c: 1 }, { x: 10, c: 1 },
    { x: 14, c: 2 }, { x: 15, c: 2 }, { x: 16, c: 2 },
];

const CLASS_COLORS = [
    {
        line: '#f97316', fill: '#f97316',
        region: 'rgba(249,115,22,0.08)',
        target: '#fdba74', targetFill: 'rgba(254,215,170,0.15)',
    },
    {
        line: '#10b981', fill: '#10b981',
        region: 'rgba(16,185,129,0.08)',
        target: '#6ee7b7', targetFill: 'rgba(167,243,208,0.15)',
    },
    {
        line: '#6366f1', fill: '#6366f1',
        region: 'rgba(99,102,241,0.08)',
        target: '#a5b4fc', targetFill: 'rgba(199,210,254,0.15)',
    },
];

const CLASS_LABELS = ['Orange', 'Green', 'Indigo'];

// --- Chart geometry (fixed viewBox coordinate space) ---

const W = 800;
const H = 400;
const PAD = 55;
const X_MIN = 0, X_MAX = 18;
const Y_MIN = -0.5, Y_MAX = 1.5;

const mapX = (x: number) => PAD + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - 2 * PAD);
const mapY = (y: number) => H - PAD - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (H - 2 * PAD);
const unmapX = (sx: number) => X_MIN + ((sx - PAD) / (W - 2 * PAD)) * (X_MAX - X_MIN);

// --- Info cards ---

const INFO_CARDS = [
    {
        color: '#f97316',
        bg: 'rgba(249,115,22,0.08)',
        border: 'rgba(249,115,22,0.2)',
        title: '1-of-K Encoding',
        desc: 'Each class k gets a binary target t_k = 1; all others 0. The model learns K separate lines.',
        formula: 't_{nk} = \\begin{cases} 1 & c_n = k \\\\ 0 & \\text{otherwise} \\end{cases}',
    },
    {
        color: '#10b981',
        bg: 'rgba(16,185,129,0.08)',
        border: 'rgba(16,185,129,0.2)',
        title: 'Least Squares',
        desc: 'A linear model y_k(x) = w_k x + b_k is fit per class via the normal equations when the design has full column rank.',
        formula: '\\mathbf{W} = (\\mathbf{X}^T\\mathbf{X})^{-1}\\mathbf{X}^T\\mathbf{T}',
    },
    {
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.08)',
        border: 'rgba(99,102,241,0.2)',
        title: 'Decision Rule',
        desc: 'Assign x to the class with the highest linear output.',
        formula: 'k^* = \\underset{k}{\\arg\\max}\\; y_k(x)',
    },
];

// --- Component ---

export default function LeastSquaresMulticlass() {
    const { topicId } = useParams();
    const [points, setPoints] = useState<DataPoint[]>(INITIAL_POINTS);
    const [keyboardX, setKeyboardX] = useState(9);
    const [selectedClass, setSelectedClass] = useState(1);
    const [showingTargetsFor, setShowingTargetsFor] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Fit one linear model per class (1-of-K encoding, PRML §4.1.2)
    const models = useMemo(() => {
        if (points.length < 3) return null;
        let sumX = 0, sumX2 = 0;
        const sumT = [0, 0, 0];
        const sumXT = [0, 0, 0];
        const n = points.length;
        points.forEach(p => {
            sumX += p.x;
            sumX2 += p.x * p.x;
            sumT[p.c] += 1;
            sumXT[p.c] += p.x;
        });
        const det = n * sumX2 - sumX * sumX;
        if (Math.abs(det) < 1e-10) return null;
        const inv00 = sumX2 / det;
        const inv01 = -sumX / det;
        const inv10 = -sumX / det;
        const inv11 = n / det;
        return [0, 1, 2].map(k => {
            const b = inv00 * sumT[k] + inv01 * sumXT[k];
            const m = inv10 * sumT[k] + inv11 * sumXT[k];
            return { k, m, b };
        });
    }, [points]);

    // Colour decision regions by argmax of the three linear outputs
    const decisionRegions = useMemo(() => {
        if (!models) return [];
        const steps = 200;
        const stepSize = (X_MAX - X_MIN) / steps;
        return Array.from({ length: steps }, (_, i) => {
            const x1 = X_MIN + i * stepSize;
            const midX = x1 + stepSize / 2;
            let highest = -Infinity, winner = 0;
            models.forEach(m => {
                const val = m.m * midX + m.b;
                if (val > highest) { highest = val; winner = m.k; }
            });
            return { x: x1, width: stepSize, c: winner };
        });
    }, [models]);

    // Use getScreenCTM so clicks are correct at any SVG scale / letterboxing
    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svgRef.current.getScreenCTM();
        if (!ctm) return;
        const svgCoord = pt.matrixTransform(ctm.inverse());
        if (svgCoord.x < PAD || svgCoord.x > W - PAD) return;
        setPoints(prev => [...prev, { x: unmapX(svgCoord.x), c: selectedClass }]);
    };

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                    1-of-K Least Squares
                </h2>
                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Click the chart or focus it and press arrow keys, then Enter, to add observations. Fitted scores are not probabilities.
                </p>
            </div>

            {/* Formula box */}
            <div style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '12px',
                textAlign: 'center',
            }}>
                <Latex formula="\mathbf{W} = (\mathbf{X}^T\mathbf{X})^{-1}\mathbf{X}^T\mathbf{T}" display />
            </div>

            {/* Add Points */}
            <div>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Add Points (Class)
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {[0, 1, 2].map(k => (
                        <button
                            key={k}
                            onClick={() => setSelectedClass(k)}
                            style={{
                                flex: 1, padding: '8px 6px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                                border: `1px solid ${selectedClass === k ? CLASS_COLORS[k].fill : '#334155'}`,
                                background: selectedClass === k ? CLASS_COLORS[k].fill : '#1e293b',
                                color: selectedClass === k ? 'white' : '#94a3b8',
                            }}
                        >
                            {CLASS_LABELS[k]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Target View */}
            <div>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Target View
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {[0, 1, 2].map(k => (
                        <button
                            key={k}
                            onClick={() => setShowingTargetsFor(showingTargetsFor === k ? null : k)}
                            style={{
                                flex: 1, padding: '8px 6px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                                border: `1px solid ${showingTargetsFor === k ? CLASS_COLORS[k].fill : '#334155'}`,
                                background: showingTargetsFor === k ? CLASS_COLORS[k].fill : '#1e293b',
                                color: showingTargetsFor === k ? 'white' : '#94a3b8',
                            }}
                        >
                            {CLASS_LABELS[k]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Reset */}
            <button
                onClick={() => { setPoints(INITIAL_POINTS); setShowingTargetsFor(null); }}
                style={{
                    padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155',
                    background: '#1e293b', color: '#94a3b8', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, width: '100%',
                }}
            >
                Reset Points
            </button>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                {CLASS_LABELS.map((label, k) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 18, height: 3, background: CLASS_COLORS[k].fill, borderRadius: '2px', flexShrink: 0 }} />
                        <span>{label} class line · colored region = decision area</span>
                    </div>
                ))}
            </div>

            {/* Info cards */}
            {INFO_CARDS.map(card => (
                <div
                    key={card.title}
                    style={{
                        background: card.bg,
                        border: `1px solid ${card.border}`,
                        borderRadius: '10px', padding: '12px',
                    }}
                >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: card.color, marginBottom: '4px' }}>
                        {card.title}
                    </div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 6px', lineHeight: 1.5 }}>
                        {card.desc}
                    </p>
                    <div style={{ fontSize: '11px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '4px 8px', textAlign: 'center' }}>
                        <Latex formula={card.formula} />
                    </div>
                </div>
            ))}

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic' }}>
                Click chart to add · Toggle target view
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                    width: '100%',
                    height: '100%',
                    cursor: 'crosshair',
                    display: 'block',
                    background: '#0b0f19',
                }}
                role="img"
                aria-label="Least-squares multiclass chart. Left and right arrows move a cursor; Enter or Space adds an observation for the selected class."
                tabIndex={0}
                onKeyDown={event => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        setKeyboardX(value => Math.max(X_MIN, Math.min(X_MAX, value + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : 0.25))));
                    } else if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPoints(previous => [...previous, { x: keyboardX, c: selectedClass }]);
                    }
                }}
                onClick={handleSvgClick}
            >
                <title>Multiclass regression scores and observed one-hot targets</title>
                <desc>Arrow keys move the yellow cursor. Enter or Space adds an observation. These fitted scores are not class probabilities.</desc>
                <line x1={mapX(keyboardX)} x2={mapX(keyboardX)} y1={mapY(Y_MIN)} y2={mapY(Y_MAX)} stroke="#facc15" strokeDasharray="3,6" /><text x={mapX(keyboardX)} y={25} fill="#facc15" fontSize={12}>Cursor x={keyboardX.toFixed(2)}</text>
                {/* Decision region coloring */}
                {decisionRegions.map((region, i) => (
                    <rect
                        key={i}
                        x={mapX(region.x)}
                        y={mapY(Y_MAX)}
                        width={mapX(region.x + region.width) - mapX(region.x)}
                        height={mapY(Y_MIN) - mapY(Y_MAX)}
                        fill={CLASS_COLORS[region.c].region}
                        opacity={showingTargetsFor !== null ? 0.3 : 1}
                    />
                ))}

                {/* Horizontal gridline at y = 1 */}
                <line
                    x1={mapX(X_MIN)} y1={mapY(1)}
                    x2={mapX(X_MAX)} y2={mapY(1)}
                    stroke="#1e293b" strokeWidth={1} strokeDasharray="4,4"
                />

                {/* Axes */}
                <line x1={mapX(X_MIN)} y1={mapY(0)} x2={mapX(X_MAX)} y2={mapY(0)} stroke="#e2e8f0" strokeWidth={2} />
                <line x1={mapX(X_MIN)} y1={mapY(Y_MIN)} x2={mapX(X_MIN)} y2={mapY(Y_MAX)} stroke="#e2e8f0" strokeWidth={2} />

                {/* Y-axis labels */}
                <text x={mapX(X_MIN) - 10} y={mapY(1)} textAnchor="end" dominantBaseline="middle" fill="#94a3b8" fontSize={13} fontWeight={700}>1.0</text>
                <text x={mapX(X_MIN) - 10} y={mapY(0)} textAnchor="end" dominantBaseline="middle" fill="#94a3b8" fontSize={13} fontWeight={700}>0.0</text>

                {/* Axis labels */}
                <text x={mapX((X_MIN + X_MAX) / 2)} y={H - 8} textAnchor="middle" fill="#64748b" fontSize={12} fontWeight={600}>
                    Input Feature Value (x)
                </text>
                <text
                    x={15} y={H / 2} textAnchor="middle"
                    transform={`rotate(-90 15 ${H / 2})`}
                    fill="#64748b" fontSize={12} fontWeight={600}
                >
                    Predicted / Target
                </text>

                {/* Fitted linear model lines */}
                {models && models.map(model => (
                    <line
                        key={model.k}
                        x1={mapX(X_MIN)} y1={mapY(model.m * X_MIN + model.b)}
                        x2={mapX(X_MAX)} y2={mapY(model.m * X_MAX + model.b)}
                        stroke={CLASS_COLORS[model.k].line}
                        strokeWidth={3.5}
                        opacity={showingTargetsFor !== null && model.k !== showingTargetsFor ? 0.1 : 1}
                    />
                ))}

                {/* Data points (plotted at y = -0.1 baseline) */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={mapX(p.x)} cy={mapY(-0.1)}
                        r={6}
                        fill={CLASS_COLORS[p.c].fill}
                        stroke="rgba(255,255,255,0.35)"
                        strokeWidth={1.5}
                        opacity={showingTargetsFor !== null ? 0.3 : 1}
                    />
                ))}

                {/* Target view overlay: dashed connectors + target circles */}
                {showingTargetsFor !== null && points.map((p, i) => {
                    const targetY = p.c === showingTargetsFor ? 1 : 0;
                    const col = CLASS_COLORS[showingTargetsFor];
                    return (
                        <g key={`tgt-${i}`}>
                            <line
                                x1={mapX(p.x)} y1={mapY(-0.1)}
                                x2={mapX(p.x)} y2={mapY(targetY)}
                                stroke={col.target}
                                strokeWidth={1.5}
                                strokeDasharray="4,4"
                            />
                            <circle
                                cx={mapX(p.x)} cy={mapY(targetY)}
                                r={8}
                                fill={col.targetFill}
                                stroke={col.fill}
                                strokeWidth={2.5}
                            />
                        </g>
                    );
                })}

                {/* X-axis ticks */}
                {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18].map(tick => (
                    <g key={tick}>
                        <line
                            x1={mapX(tick)} y1={mapY(0)}
                            x2={mapX(tick)} y2={mapY(0) + 5}
                            stroke="#475569" strokeWidth={1.5}
                        />
                        <text x={mapX(tick)} y={mapY(0) + 20} textAnchor="middle" fill="#64748b" fontSize={11}>
                            {tick}
                        </text>
                    </g>
                ))}
            </svg>
        </SceneContainer>
    );
}
