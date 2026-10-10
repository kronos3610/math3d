import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// ---------------------------------------------------------------------------
// Data generation — fixed seed, computed once at module load
// ---------------------------------------------------------------------------

const CHART_W = 560;
const CHART_H = 400;


function gauss(x: number, mu: number, sigma: number) {
    return (1 / (sigma * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

const seed = (s: number) => {
    let x = s;
    return () => { x = (x * 16807 + 0) % 2147483647; return (x - 1) / 2147483646; };
};
const rng = seed(42);
function randNorm(mu: number, sigma: number) {
    const u1 = rng(), u2 = rng();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1 + 0.001)) * Math.cos(2 * Math.PI * u2);
}

interface Pt { x: number; y: number }

const CLASS1: Pt[] = Array.from({ length: 30 }, () => ({ x: randNorm(160, 35), y: randNorm(250, 40) }));
const CLASS2: Pt[] = Array.from({ length: 30 }, () => ({ x: randNorm(340, 35), y: randNorm(160, 40) }));

function getStats(pts: Pt[]) {
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const p = pts[i];
        sx += p.x; sy += p.y;
        sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y;
    }
    const mx = sx / n, my = sy / n;
    return {
        m: { x: mx, y: my },
        sxx: (sxx - (sx * sx) / n) / n,
        syy: (syy - (sy * sy) / n) / n,
        sxy: (sxy - (sx * sy) / n) / n,
    };
}
const stats1 = getStats(CLASS1), stats2 = getStats(CLASS2);
const m1 = stats1.m, m2 = stats2.m;
const sw1xx = stats1.sxx, sw1yy = stats1.syy, sw1xy = stats1.sxy;
const sw2xx = stats2.sxx, sw2yy = stats2.syy, sw2xy = stats2.sxy;
const Sxx = sw1xx + sw2xx, Syy = sw1yy + sw2yy, Sxy = sw1xy + sw2xy;

const det = Sxx * Syy - Sxy * Sxy;
const invSxx = Syy / det, invSyy = Sxx / det, invSxy = -Sxy / det;

const dx = m2.x - m1.x, dy = m2.y - m1.y;
let wx = invSxx * dx + invSxy * dy;
let wy = invSxy * dx + invSyy * dy;
const wlen = Math.sqrt(wx * wx + wy * wy);
wx /= wlen; wy /= wlen;

function project(p: Pt) { return p.x * wx + p.y * wy; }

const proj1 = CLASS1.map(project);
const proj2 = CLASS2.map(project);

function get1DStats(vals: number[]) {
    let s = 0, ss = 0;
    const n = vals.length;
    for (let i = 0; i < n; i++) {
        const v = vals[i];
        s += v; ss += v * v;
    }
    const mu = s / n;
    const sig = Math.sqrt(Math.max(0, (ss - (s * s) / n) / n));
    return { mu, sig };
}
const pstats1 = get1DStats(proj1), pstats2 = get1DStats(proj2);
const mu1p = pstats1.mu, mu2p = pstats2.mu, sig1p = pstats1.sig, sig2p = pstats2.sig;
const y0 = (mu1p * sig2p + mu2p * sig1p) / (sig1p + sig2p);

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
    {
        id: 0, label: 'Raw Data',
        title: 'Step 1 — The Raw Data',
        desc: 'Two classes of 2D points. Red (Class 1) clusters bottom-left; blue (Class 2) top-right. Goal: find the best 1D line to project onto so they separate cleanly.',
        formula: null,
    },
    {
        id: 1, label: 'Class Means',
        title: 'Step 2 — Class Means',
        desc: 'Compute the centroid of each class. The vector (m₂ − m₁) points from one center to the other — a natural first candidate for the projection direction.',
        formula: 'm_1 = \\tfrac{1}{N_1}\\!\\sum_{n \\in C_1}\\! x_n, \\quad m_2 = \\tfrac{1}{N_2}\\!\\sum_{n \\in C_2}\\! x_n',
    },
    {
        id: 2, label: 'Naïve Dir.',
        title: 'Step 3 — Why Naïve (m₂ − m₁) Fails',
        desc: 'Projecting along the raw (m₂ − m₁) direction (dashed) causes heavy shadow overlap because the data is tilted. We must account for within-class scatter S_W.',
        formula: 'w_{\\text{naïve}} = m_2 - m_1 \\;\\rightarrow\\; \\text{overlapping shadows}',
    },
    {
        id: 3, label: "Fisher's w",
        title: "Step 4 — Fisher's Direction",
        desc: "S_W⁻¹ 'whitens' the direction — it stretches/rotates (m₂ − m₁) to counteract internal class spread. The result maximises between-class to within-class variance.",
        formula: 'w \\propto S_W^{-1}(m_2 - m_1) \\quad [\\text{PRML Eq. 4.30}]',
    },
    {
        id: 4, label: 'Projections',
        title: 'Step 5 — Project Onto w',
        desc: "Every point is collapsed to a scalar y = wᵀx along the gold axis. The 1D shadows below show the classes are now much better separated.",
        formula: 'y = w^T x',
    },
    {
        id: 5, label: 'Gaussians',
        title: 'Step 6 — Fit Gaussians & Threshold y₀',
        desc: 'Model each shadow as a 1D Gaussian. The threshold y₀ is where the two curves intersect — the optimal cutoff. Click the scatter plot to classify a new point!',
        formula: 'y \\geq y_0 \\Rightarrow C_2 \\quad | \\quad y < y_0 \\Rightarrow C_1',
    },
];

// ---------------------------------------------------------------------------
// Scatter plot draw (responsive, uniform-scale)
// ---------------------------------------------------------------------------

function drawScatter(
    canvas: HTMLCanvasElement,
    step: number,
    testPoint: Pt | null,
    scaleOut: { scale: number; offsetX: number; offsetY: number },
) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;

    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
    }

    const scale = Math.min(cw / CHART_W, ch / CHART_H);
    const offsetX = (cw - CHART_W * scale) / 2;
    const offsetY = (ch - CHART_H * scale) / 2;
    scaleOut.scale = scale;
    scaleOut.offsetX = offsetX;
    scaleOut.offsetY = offsetY;

    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
    ctx.clearRect(-offsetX / scale, -offsetY / scale, cw / scale, ch / scale);

    // Background
    ctx.fillStyle = '#0d0f1a';
    ctx.fillRect(-offsetX / scale, -offsetY / scale, cw / scale, ch / scale);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CHART_W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CHART_H); ctx.stroke();
    }
    for (let y = 0; y <= CHART_H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHART_W, y); ctx.stroke();
    }

    // Fisher axis (step >= 3)
    if (step >= 3) {
        const cx = CHART_W / 2, cy = CHART_H / 2, ext = 300;
        ctx.save();
        ctx.strokeStyle = '#f0c040';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(cx - wx * ext, cy - wy * ext);
        ctx.lineTo(cx + wx * ext, cy + wy * ext);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f0c040';
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.fillText('w (Fisher)', cx + wx * ext - 68, cy + wy * ext + 16);
        ctx.restore();
    }

    // Naïve direction (step 2)
    if (step === 2) {
        const ndx = m2.x - m1.x, ndy = m2.y - m1.y;
        const nl = Math.sqrt(ndx * ndx + ndy * ndy);
        const nx = ndx / nl, ny = ndy / nl;
        const cx = CHART_W / 2, cy = CHART_H / 2, ext = 260;
        ctx.save();
        ctx.strokeStyle = 'rgba(180,180,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(cx - nx * ext, cy - ny * ext);
        ctx.lineTo(cx + nx * ext, cy + ny * ext);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(180,180,255,0.7)';
        ctx.font = "12px 'Courier New', monospace";
        ctx.fillText('m₂−m₁ (naïve)', cx + nx * ext - 88, cy + ny * ext - 8);
        ctx.restore();
    }

    // Projection lines (step >= 4)
    if (step >= 4) {
        const perpX = -wy, perpY = wx;
        const offset = 40;
        const refProj = project({ x: CHART_W / 2, y: CHART_H / 2 });
        const bcx = CHART_W / 2 + perpX * offset, bcy = CHART_H / 2 + perpY * offset;

        // Shadow axis line
        ctx.save();
        ctx.strokeStyle = 'rgba(240,192,64,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bcx - wx * 300, bcy - wy * 300);
        ctx.lineTo(bcx + wx * 300, bcy + wy * 300);
        ctx.stroke();

        // Projection lines from each point
        [...CLASS1.map((p, i) => ({ p, v: proj1[i], cls: 1 })), ...CLASS2.map((p, i) => ({ p, v: proj2[i], cls: 2 }))].forEach(({ p, v, cls }) => {
            const dp = v - refProj;
            const px2 = bcx + wx * dp, py2 = bcy + wy * dp;
            ctx.strokeStyle = cls === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(99,179,237,0.15)';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(px2, py2); ctx.stroke();
        });

        // Shadow ticks
        [...proj1.map(v => ({ v, cls: 1 })), ...proj2.map(v => ({ v, cls: 2 }))].forEach(({ v, cls }) => {
            const dp = v - refProj;
            const px = bcx + wx * dp, py = bcy + wy * dp;
            ctx.fillStyle = cls === 1 ? 'rgba(239,68,68,0.75)' : 'rgba(99,179,237,0.75)';
            ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
        });

        // Threshold tick (step >= 5)
        if (step >= 5) {
            const dp = y0 - refProj;
            const tx = bcx + wx * dp, ty = bcy + wy * dp;
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx - perpX * 10, ty - perpY * 10);
            ctx.lineTo(tx + perpX * 10, ty + perpY * 10);
            ctx.stroke();
            ctx.fillStyle = '#34d399';
            ctx.font = "bold 12px 'Courier New', monospace";
            ctx.fillText('y₀', tx + 6, ty - 8);
        }
        ctx.restore();
    }

    // Data points
    const drawPoints = (pts: Pt[], fill: string, stroke: string) => {
        pts.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = fill; ctx.fill();
            ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
        });
    };
    drawPoints(CLASS1, 'rgba(239,68,68,0.75)', 'rgba(239,68,68,0.9)');
    drawPoints(CLASS2, 'rgba(99,179,237,0.75)', 'rgba(99,179,237,0.9)');

    // Means + arrow (step >= 1)
    if (step >= 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ([
            [m1, '#ef4444', 'm₁'],
            [m2, '#63b3ed', 'm₂'],
        ] as [Pt, string, string][]).forEach(([m, c, lbl]) => {
            ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
            ctx.fillStyle = c; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = "bold 13px 'Courier New', monospace";
            ctx.fillText(lbl, m.x + 12, m.y - 8);
        });
    }

    // Test point (step 5)
    if (step >= 5 && testPoint) {
        const yval = testPoint.x * wx + testPoint.y * wy;
        const cls = yval >= y0 ? 2 : 1;
        const col = cls === 1 ? '#ef4444' : '#63b3ed';
        ctx.beginPath(); ctx.arc(testPoint.x, testPoint.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = "bold 11px 'Courier New', monospace";
        ctx.fillText(`?→${cls === 1 ? 'C1' : 'C2'}`, testPoint.x + 11, testPoint.y - 9);
    }

    // Legend overlay
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(CHART_W - 140, 8, 132, step >= 3 ? (step >= 5 ? 62 : 48) : 34);
    ctx.fillStyle = '#ef4444'; ctx.fillText('● Class 1', CHART_W - 132, 24);
    ctx.fillStyle = '#63b3ed'; ctx.fillText('● Class 2', CHART_W - 132, 38);
    if (step >= 3) { ctx.fillStyle = '#f0c040'; ctx.fillText('— w (Fisher)', CHART_W - 132, 52); }
    if (step >= 5) { ctx.fillStyle = '#34d399'; ctx.fillText('| threshold y₀', CHART_W - 132, 66); }
}

// ---------------------------------------------------------------------------
// Gaussian chart draw (responsive)
// ---------------------------------------------------------------------------

function drawGaussian(canvas: HTMLCanvasElement, step: number) {
    if (step < 4) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const GW = rect.width, GH = rect.height;

    if (canvas.width !== Math.round(GW * dpr) || canvas.height !== Math.round(GH * dpr)) {
        canvas.width = Math.round(GW * dpr);
        canvas.height = Math.round(GH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, GW, GH);

    ctx.fillStyle = '#080b14';
    ctx.fillRect(0, 0, GW, GH);

    const PAD = 28;
    const minP = Math.min(mu1p, mu2p) - 3.5 * Math.max(sig1p, sig2p);
    const maxP = Math.max(mu1p, mu2p) + 3.5 * Math.max(sig1p, sig2p);
    const toX = (v: number) => PAD + (v - minP) / (maxP - minP) * (GW - 2 * PAD);

    // Axis
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, GH - 18); ctx.lineTo(GW - PAD, GH - 18); ctx.stroke();

    // Header label
    ctx.fillStyle = '#f0c040';
    ctx.font = "bold 10px 'Courier New', monospace";
    ctx.fillText(step >= 5 ? '1D PROJECTION — GAUSSIANS + THRESHOLD' : '1D PROJECTION — SHADOWS', PAD, 14);

    // Shadow ticks
    [...proj1.map(v => ({ v, cls: 1 })), ...proj2.map(v => ({ v, cls: 2 }))].forEach(({ v, cls }) => {
        const x = toX(v);
        ctx.fillStyle = cls === 1 ? 'rgba(239,68,68,0.7)' : 'rgba(99,179,237,0.7)';
        ctx.fillRect(x - 1.5, GH - 24, 3, 7);
    });

    if (step < 5) return;

    const maxG = Math.max(gauss(mu1p, mu1p, sig1p), gauss(mu2p, mu2p, sig2p));
    const toY = (g: number) => GH - 26 - (g / maxG) * (GH - 50);
    const NSTEPS = 300;

    const drawGaussCurve = (mu: number, sig: number, color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        for (let i = 0; i <= NSTEPS; i++) {
            const xv = minP + (i / NSTEPS) * (maxP - minP);
            const px = toX(xv), py = toY(gauss(xv, mu, sig));
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Fill
        ctx.beginPath();
        ctx.moveTo(toX(minP), GH - 26);
        for (let i = 0; i <= NSTEPS; i++) {
            const xv = minP + (i / NSTEPS) * (maxP - minP);
            ctx.lineTo(toX(xv), toY(gauss(xv, mu, sig)));
        }
        ctx.lineTo(toX(maxP), GH - 26);
        ctx.closePath();
        ctx.fillStyle = color.replace('0.9)', '0.12)');
        ctx.fill();
    };

    drawGaussCurve(mu1p, sig1p, 'rgba(239,68,68,0.9)');
    drawGaussCurve(mu2p, sig2p, 'rgba(99,179,237,0.9)');

    // Threshold
    const tx = toX(y0);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(tx, 18); ctx.lineTo(tx, GH - 18); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#34d399';
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText('y₀', tx + 4, 30);

    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = '#ef4444'; ctx.fillText('μ₁', toX(mu1p) - 8, GH - 28);
    ctx.fillStyle = '#63b3ed'; ctx.fillText('μ₂', toX(mu2p) - 8, GH - 28);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FisherLDA() {
    const { topicId } = useParams();
    const [step, setStep] = useState(0);
    const [testPoint, setTestPoint] = useState<Pt | null>(null);
    const [animating, setAnimating] = useState(false);

    const scatterRef = useRef<HTMLCanvasElement>(null);
    const gaussRef = useRef<HTMLCanvasElement>(null);
    const scaleRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

    // Keep refs current for stable draw callbacks
    const stepRef = useRef(step);
    const testPointRef = useRef(testPoint);
    useEffect(() => {
        stepRef.current = step;
        testPointRef.current = testPoint;
    }, [step, testPoint]);

    const redrawScatter = useCallback(() => {
        if (scatterRef.current)
            drawScatter(scatterRef.current, stepRef.current, testPointRef.current, scaleRef.current);
    }, []);

    const redrawGauss = useCallback(() => {
        if (gaussRef.current)
            drawGaussian(gaussRef.current, stepRef.current);
    }, []);

    // Redraw when step or testPoint changes
    useEffect(() => { redrawScatter(); redrawGauss(); }, [step, testPoint, redrawScatter, redrawGauss]);

    // ResizeObservers
    useEffect(() => {
        const canvas = scatterRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => redrawScatter());
        ro.observe(canvas);
        redrawScatter();
        return () => ro.disconnect();
    }, [redrawScatter]);

    useEffect(() => {
        const canvas = gaussRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => redrawGauss());
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [redrawGauss]);

    const goTo = (s: number) => {
        if (s < 0 || s >= STEPS.length) return;
        setAnimating(true);
        setTestPoint(null);
        setTimeout(() => { setStep(s); setAnimating(false); }, 150);
    };

    const handleScatterClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (step < 5) return;
        const rect = scatterRef.current!.getBoundingClientRect();
        const { scale, offsetX, offsetY } = scaleRef.current;
        const cx = (e.clientX - rect.left - offsetX) / scale;
        const cy = (e.clientY - rect.top - offsetY) / scale;
        if (cx >= 0 && cx <= CHART_W && cy >= 0 && cy <= CHART_H)
            setTestPoint({ x: cx, y: cy });
    };

    const info = STEPS[step];
    const testYVal = testPoint ? testPoint.x * wx + testPoint.y * wy : null;

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Title */}
            <div>
                <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#f0c040', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Bishop § 4.1.4
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>
                    Fisher's Linear Discriminant
                </h2>
                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Step-by-step interactive derivation
                </p>
            </div>

            {/* Step tabs */}
            <div>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Steps
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {STEPS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            style={{
                                padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                fontSize: '11px', fontWeight: step === i ? 700 : 400, transition: 'all 0.2s',
                                background: step === i ? '#f0c040' : 'rgba(255,255,255,0.07)',
                                color: step === i ? '#0d0f1a' : '#94a3b8',
                            }}
                        >
                            {i + 1}. {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Step info */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(240,192,64,0.2)',
                borderLeft: '3px solid #f0c040',
                borderRadius: '8px', padding: '12px',
            }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f0c040', marginBottom: '6px' }}>
                    {info.title}
                </div>
                <div style={{ fontSize: '11px', lineHeight: 1.7, color: '#cbd5e1' }}>
                    {info.desc}
                </div>
            </div>

            {/* Formula */}
            {info.formula && (
                <div style={{
                    background: 'rgba(30,41,59,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px', padding: '10px',
                    textAlign: 'center',
                }}>
                    <Latex formula={info.formula} display />
                </div>
            )}

            {/* Classification result */}
            {step === 5 && testPoint && testYVal !== null && (
                <div style={{
                    background: testYVal >= y0 ? 'rgba(99,179,237,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${testYVal >= y0 ? 'rgba(99,179,237,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: '10px', padding: '12px', fontSize: '11px',
                }}>
                    <div style={{ fontWeight: 700, color: testYVal >= y0 ? '#63b3ed' : '#ef4444', marginBottom: '4px', fontSize: '12px' }}>
                        → {testYVal >= y0 ? 'Class 2 (Blue)' : 'Class 1 (Red)'}
                    </div>
                    <div style={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                        y = {testYVal.toFixed(1)} &nbsp;|&nbsp; y₀ = {y0.toFixed(1)}
                    </div>
                </div>
            )}

            {/* Prev / Next */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => goTo(step - 1)} disabled={step === 0}
                    style={{
                        flex: 1, padding: '8px', borderRadius: '8px',
                        border: '1px solid #334155', background: '#1e293b',
                        color: step === 0 ? '#334155' : '#94a3b8',
                        cursor: step === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '12px', fontWeight: 600,
                    }}
                >
                    ← Prev
                </button>
                <span style={{ color: '#475569', fontSize: '12px', alignSelf: 'center', flexShrink: 0 }}>
                    {step + 1}/{STEPS.length}
                </span>
                <button
                    onClick={() => goTo(step + 1)} disabled={step === STEPS.length - 1}
                    style={{
                        flex: 1, padding: '8px', borderRadius: '8px',
                        border: '1px solid rgba(240,192,64,0.3)',
                        background: step === STEPS.length - 1 ? 'rgba(240,192,64,0.1)' : '#f0c040',
                        color: step === STEPS.length - 1 ? '#475569' : '#0d0f1a',
                        cursor: step === STEPS.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '12px', fontWeight: 700,
                    }}
                >
                    Next →
                </button>
            </div>

            {step === 5 && (
                <p style={{ fontSize: '11px', color: '#34d399', textAlign: 'center', fontStyle: 'italic' }}>
                    Click the scatter plot to classify a new point
                </p>
            )}

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic' }}>
                Step through to build intuition
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                opacity: animating ? 0 : 1,
                transition: 'opacity 0.15s',
            }}>
                {/* Main scatter plot — fills available space */}
                <canvas
                    ref={scatterRef}
                    style={{
                        flex: 1, minHeight: 0, display: 'block',
                        cursor: step >= 5 ? 'crosshair' : 'default',
                    }}
                    onClick={handleScatterClick}
                />
                {/* Gaussian chart — shown from step 4 */}
                <canvas
                    ref={gaussRef}
                    style={{
                        flexShrink: 0,
                        height: step >= 4 ? '28%' : '0',
                        display: 'block',
                        borderTop: step >= 4 ? '1px solid #1e293b' : 'none',
                        transition: 'height 0.3s',
                    }}
                />
            </div>
        </SceneContainer>
    );
}
