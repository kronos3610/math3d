import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// --- Canvas helpers ---

function drawArrowhead(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    angle: number,
    color: string,
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, -7);
    ctx.lineTo(-14, 7);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

// --- Main Component ---

export default function LinearDiscriminants() {
    const { topicId } = useParams();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Slider state (triggers re-renders for the control panel)
    const [wAngle, setWAngle] = useState(45);
    const [wMag, setWMag] = useState(80);
    const [wBias, setWBias] = useState(-3200);

    // Refs mirror the slider state so event handlers never close over stale values
    const wAngleRef = useRef(45);
    const wMagRef = useRef(80);
    const wBiasRef = useRef(-3200);

    // Draggable test point (canvas-local coords, relative to centre)
    const testPointRef = useRef({ x: 80, y: -60 });
    const isDragging = useRef(false);

    // Live stats for the control panel
    const [yVal, setYVal] = useState(0);
    const [rVal, setRVal] = useState(0);
    const [isC1, setIsC1] = useState(true);

    // ---- Draw -------------------------------------------------------
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const W = rect.width;
        const H = rect.height;

        if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const cx = W / 2;
        const cy = H / 2;

        const angleRad = (wAngleRef.current * Math.PI) / 180;
        const mag = wMagRef.current;
        const w0 = wBiasRef.current;
        const wx = Math.cos(angleRad) * mag;
        const wy = -Math.sin(angleRad) * mag;

        // Background
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = -Math.max(W, H); i < Math.max(W, H); i += 40) {
            ctx.moveTo(cx + i, 0);   ctx.lineTo(cx + i, H);
            ctx.moveTo(0, cy + i);   ctx.lineTo(W, cy + i);
        }
        ctx.stroke();

        // Axes
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
        ctx.moveTo(0, cy); ctx.lineTo(W, cy);
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);

        // Decision boundary (red)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(239,68,68,0.45)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        if (Math.abs(wy) > 0.01) {
            const x1 = -cx - 60, x2 = cx + 60;
            ctx.moveTo(x1, (-wx * x1 - w0) / wy);
            ctx.lineTo(x2, (-wx * x2 - w0) / wy);
        } else {
            const x = -w0 / wx;
            ctx.moveTo(x, -cy - 60);
            ctx.lineTo(x,  cy + 60);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Dashed line: origin → boundary projection
        const originDist = -w0 / mag;
        const px = originDist * (wx / mag);
        const py = originDist * (wy / mag);

        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small dot at origin-to-boundary foot
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Weight vector (blue arrow)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(59,130,246,0.55)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(wx, wy);
        ctx.stroke();
        ctx.shadowBlur = 0;
        drawArrowhead(ctx, wx, wy, Math.atan2(wy, wx), '#3b82f6');

        ctx.fillStyle = '#93c5fd';
        ctx.font = 'italic bold 18px Georgia, "Times New Roman", serif';
        ctx.fillText('w', wx + 12, wy - 8);

        // Test point math
        const tp = testPointRef.current;
        const yv = wx * tp.x + wy * tp.y + w0;
        const r  = yv / mag;

        // Foot of perpendicular from test point to decision boundary
        const footX = tp.x - r * (wx / mag);
        const footY = tp.y - r * (wy / mag);

        // Dashed perpendicular distance line (green)
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tp.x, tp.y);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Right-angle marker at foot
        const nx_u = wx / mag;         // unit normal (parallel to w)
        const ny_u = wy / mag;
        const bx_u = -ny_u;            // unit along boundary
        const by_u =  nx_u;
        const MS = 8;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(footX + bx_u * MS,              footY + by_u * MS);
        ctx.lineTo(footX + bx_u * MS + nx_u * MS,  footY + by_u * MS + ny_u * MS);
        ctx.lineTo(footX             + nx_u * MS,  footY             + ny_u * MS);
        ctx.stroke();

        // r label at midpoint of the distance line
        const midX = (tp.x + footX) / 2;
        const midY = (tp.y + footY) / 2;
        ctx.fillStyle = '#4ade80';
        ctx.font = '13px "system-ui", sans-serif';
        ctx.fillText(`r = ${r.toFixed(1)}`, midX + 8, midY);

        // Test point dot (colour = class)
        const ptColor = yv >= 0 ? '#22c55e' : '#f87171';
        const ptGlow  = yv >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(248,113,113,0.5)';
        ctx.fillStyle = ptGlow;
        ctx.shadowColor = ptGlow;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = ptColor;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = yv >= 0 ? '#86efac' : '#fca5a5';
        ctx.font = 'italic bold 18px Georgia, "Times New Roman", serif';
        ctx.fillText('x', tp.x + 14, tp.y - 10);

        ctx.restore();

        // Update stats
        setYVal(yv);
        setRVal(r);
        setIsC1(yv >= 0);
    }, []);

    // Sync refs → draw whenever sliders change
    useEffect(() => {
        wAngleRef.current = wAngle;
        wMagRef.current   = wMag;
        wBiasRef.current  = wBias;
        draw();
    }, [wAngle, wMag, wBias, draw]);

    // Mouse / touch drag handlers (set up once)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        function getPos(e: MouseEvent | TouchEvent) {
            const rect = canvas!.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            return {
                x: clientX - rect.left  - rect.width  / 2,
                y: clientY - rect.top   - rect.height / 2,
            };
        }

        function onDown(e: MouseEvent) {
            const p = getPos(e);
            if (Math.hypot(p.x - testPointRef.current.x, p.y - testPointRef.current.y) < 28)
                isDragging.current = true;
        }
        function onMove(e: MouseEvent) {
            if (!isDragging.current) return;
            testPointRef.current = getPos(e);
            draw();
        }
        function onUp() { isDragging.current = false; }

        function onTouchStart(e: TouchEvent) {
            const p = getPos(e);
            if (Math.hypot(p.x - testPointRef.current.x, p.y - testPointRef.current.y) < 38) {
                isDragging.current = true;
                e.preventDefault();
            }
        }
        function onTouchMove(e: TouchEvent) {
            if (!isDragging.current) return;
            testPointRef.current = getPos(e);
            draw();
            e.preventDefault();
        }
        function onTouchEnd() { isDragging.current = false; }

        canvas.addEventListener('mousedown',  onDown);
        window.addEventListener('mousemove',  onMove);
        window.addEventListener('mouseup',    onUp);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
        canvas.addEventListener('touchend',   onTouchEnd);

        return () => {
            canvas.removeEventListener('mousedown',  onDown);
            window.removeEventListener('mousemove',  onMove);
            window.removeEventListener('mouseup',    onUp);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove',  onTouchMove);
            canvas.removeEventListener('touchend',   onTouchEnd);
        };
    }, [draw]);

    // ResizeObserver — redraw when canvas size changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => draw());
        ro.observe(canvas);
        draw();
        return () => ro.disconnect();
    }, [draw]);

    // ---- Controls panel ---------------------------------------------
    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                    Linear Discriminant Geometry
                </h2>
                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Drag the point to explore the decision surface.
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
                <Latex formula="y(\mathbf{x}) = \mathbf{w}^T\mathbf{x} + w_0" display />
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Decision boundary where y(<b>x</b>) = 0
                </p>
            </div>

            {/* w Angle */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        w Angle
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        {wAngle}°
                    </span>
                </div>
                <input aria-label="w Angle" type="range" min="0" max="360" step="1" value={wAngle}
                    onChange={e => setWAngle(Number(e.target.value))}
                    style={{ width: '100%' }} />
            </div>

            {/* Magnitude */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Magnitude ‖w‖
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        {wMag}
                    </span>
                </div>
                <input aria-label="Magnitude" type="range" min="10" max="150" step="1" value={wMag}
                    onChange={e => setWMag(Number(e.target.value))}
                    style={{ width: '100%' }} />
            </div>

            {/* Bias */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Bias w₀
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        {wBias}
                    </span>
                </div>
                <input aria-label="Bias" type="range" min="-20000" max="20000" step="100" value={wBias}
                    onChange={e => setWBias(Number(e.target.value))}
                    style={{ width: '100%' }} />
                <p style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>
                    Boundary offset from origin: <Latex formula="-w_0/\|\mathbf{w}\|" /> pixels
                </p>
            </div>

            {/* Live stats */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                padding: '12px',
            }}>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    Live Values
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>
                            <Latex formula="y(\mathbf{x})" />
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px', color: isC1 ? '#60a5fa' : '#f87171', fontWeight: 700 }}>
                            {yVal.toFixed(0)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>
                            Signed distance <Latex formula="r" />
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#4ade80', fontWeight: 700 }}>
                            {rVal.toFixed(2)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>Decision</span>
                        <span style={{
                            fontWeight: 700,
                            fontSize: '13px',
                            color: isC1 ? '#60a5fa' : '#f87171',
                            background: isC1 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                        }}>
                            {isC1 ? 'Class C₁' : 'Class C₂'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 18, height: 3, background: '#3b82f6', borderRadius: '2px', flexShrink: 0 }} />
                    <span>Weight vector <b>w</b> (normal to boundary)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 18, height: 3, background: '#ef4444', borderRadius: '2px', flexShrink: 0 }} />
                    <span>Boundary y(<b>x</b>) = 0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 12, height: 12, background: '#22c55e', borderRadius: '50%', flexShrink: 0 }} />
                    <span>Test point <b>x</b> — drag me</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 18, height: 2, borderTop: '2px dashed #475569', flexShrink: 0 }} />
                    <span>Signed boundary offset</span>
                </div>
            </div>

            {/* Key facts */}
            <div style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '11px',
                color: '#a5b4fc',
                lineHeight: 1.6,
            }}>
                <b style={{ color: '#818cf8' }}>Key facts:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><b>w</b> is orthogonal to every vector in the boundary.</li>
                    <li>Signed boundary offset = <Latex formula="-w_0/\|\mathbf{w}\|" />.</li>
                    <li>Signed distance = <Latex formula="r = y(\mathbf{x})/\|\mathbf{w}\|" />.</li>
                </ul>
            </div>

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic' }}>
                Drag the green dot or focus the canvas and use arrow keys · Adjust sliders
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <canvas
                ref={canvasRef}
                role="img" tabIndex={0}
                aria-label="Linear discriminant boundary. Use arrow keys to move the test point; hold Shift for larger steps."
                onKeyDown={event => {
                    const directions: Record<string, [number, number]> = {
                        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
                    };
                    const direction = directions[event.key];
                    if (!direction) return;
                    event.preventDefault();
                    const amount = event.shiftKey ? 20 : 5;
                    const point = testPointRef.current;
                    testPointRef.current = { x: point.x + direction[0] * amount, y: point.y + direction[1] * amount };
                    draw();
                }}
                style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
            />
        </SceneContainer>
    );
}
