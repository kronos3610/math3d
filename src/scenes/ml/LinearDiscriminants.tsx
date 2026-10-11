import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
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

const POINT_PADDING = 28;
const DEFAULT_POINT = { x: 80, y: -60 };

function clampPoint(point: { x: number; y: number }, width: number, height: number) {
    const horizontal = Math.max(0, width / 2 - POINT_PADDING);
    const vertical = Math.max(0, height / 2 - POINT_PADDING);
    return { x: Math.max(-horizontal, Math.min(horizontal, point.x)), y: Math.max(-vertical, Math.min(vertical, point.y)) };
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
    const testPointRef = useRef({ ...DEFAULT_POINT });
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
        if (W <= 0 || H <= 0) return;
        // Every input path and resize comes through draw, so the point and its
        // label remain visible while coordinates retain their centered pixel units.
        testPointRef.current = clampPoint(testPointRef.current, W, H);

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
        ctx.fillStyle = VIZ.background;
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = VIZ.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = -Math.max(W, H); i < Math.max(W, H); i += 40) {
            ctx.moveTo(cx + i, 0);   ctx.lineTo(cx + i, H);
            ctx.moveTo(0, cy + i);   ctx.lineTo(W, cy + i);
        }
        ctx.stroke();

        // Axes
        ctx.strokeStyle = VIZ.axis;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
        ctx.moveTo(0, cy); ctx.lineTo(W, cy);
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);

        // Decision boundary (red)
        ctx.strokeStyle = VIZ.output;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = VIZ.output;
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
        ctx.strokeStyle = VIZ.muted;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small dot at origin-to-boundary foot
        ctx.fillStyle = VIZ.muted;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Weight vector (blue arrow)
        ctx.strokeStyle = VIZ.data;
        ctx.lineWidth = 3;
        ctx.shadowColor = VIZ.data;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(wx, wy);
        ctx.stroke();
        ctx.shadowBlur = 0;
        drawArrowhead(ctx, wx, wy, Math.atan2(wy, wx), VIZ.data);

        ctx.fillStyle = VIZ.data;
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
        ctx.strokeStyle = VIZ.variation;
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
        ctx.strokeStyle = VIZ.variation;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(footX + bx_u * MS,              footY + by_u * MS);
        ctx.lineTo(footX + bx_u * MS + nx_u * MS,  footY + by_u * MS + ny_u * MS);
        ctx.lineTo(footX             + nx_u * MS,  footY             + ny_u * MS);
        ctx.stroke();

        // r label at midpoint of the distance line
        const midX = (tp.x + footX) / 2;
        const midY = (tp.y + footY) / 2;
        ctx.fillStyle = VIZ.variation;
        ctx.font = '13px "system-ui", sans-serif';
        ctx.fillText(`r = ${r.toFixed(1)}`, midX + 8, midY);

        // Test point dot (colour = class)
        const ptColor = VIZ.focus;
        const ptGlow = VIZ.focus;
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

        ctx.fillStyle = VIZ.focus;
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
        canvas.addEventListener('touchcancel', onTouchEnd);

        return () => {
            canvas.removeEventListener('mousedown',  onDown);
            window.removeEventListener('mousemove',  onMove);
            window.removeEventListener('mouseup',    onUp);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove',  onTouchMove);
            canvas.removeEventListener('touchend',   onTouchEnd);
            canvas.removeEventListener('touchcancel', onTouchEnd);
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

    return <VisualLab title="Linear discriminant geometry" subtitle="Move the point across the boundary; its signed score changes class."
        backUrl={`/${topicId || 'ml'}`} metrics={[{ label: 'Score y(x)', value: yVal.toFixed(0) }, { label: 'Signed distance r', value: rVal.toFixed(2) },
            { label: 'Decision', value: isC1 ? 'Class C₁' : 'Class C₂' }, { label: 'Boundary offset', value: (-wBias / wMag).toFixed(2) }]}
        legend={[{ label: 'w', meaning: 'weight vector normal to the boundary', color: VIZ.data, shape: 'line' }, { label: 'Boundary', meaning: 'y(x) = 0', color: VIZ.output, shape: 'line' },
            { label: 'Point x', meaning: 'selected draggable input', color: VIZ.focus }, { label: 'Dashed r', meaning: 'signed perpendicular distance', color: VIZ.variation, shape: 'line' }]}
        controls={<><LabRange label="w Angle" value={wAngle} min={0} max={360} onChange={setWAngle} />
            <LabRange label="Magnitude" value={wMag} min={10} max={150} onChange={setWMag} />
            <LabRange label="Bias" value={wBias} min={-20000} max={20000} step={100} onChange={setWBias} />
            <button type="button" className="lab-button" onClick={() => { testPointRef.current = { ...DEFAULT_POINT }; draw(); }}>Reset point</button></>}
        insight={`The point has y(x) = ${yVal.toFixed(0)} and belongs to ${isC1 ? 'C₁ (nonnegative)' : 'C₂ (negative)'}. Dividing the score by ‖w‖ gives distance r = ${rVal.toFixed(2)} in canvas pixels.`}
        challenge="Change the magnitude and bias together by the same factor. Why do the decision boundary and signed distance stay in place?"
        explanation={<div className="lab-explanation"><Latex formula="y(\mathbf{x}) = \mathbf{w}^T\mathbf{x} + w_0" display />
            <p>The line y(x) = 0 is perpendicular to w. Its signed offset is −w₀/‖w‖. The native canvas uses pixel coordinates with the origin at its center; the vertical mathematical direction is upward.</p>
            <p>Drag the point, or focus the canvas and use arrow keys. Hold Shift for larger steps. The point stays inside the plot; Reset point restores its starting pixel coordinates within the current view. These are geometric scores, not calibrated probabilities.</p></div>}>
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
                className="lab-native-canvas"
            />
        </VisualLab>;
}
