import { useMemo, useState } from 'react';
import { SpatialScene, type LabVector, type SpatialSurface } from '../../components/3d/SpatialScene';
import { VisualLab, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';

/* Math utilities */
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

type FunctionType = 'sin' | 'exp' | 'log';

const getDeriv = (f: FunctionType, n: number, a: number): number => {
    if (f === 'sin') {
        return [Math.sin(a), Math.cos(a), -Math.sin(a), -Math.cos(a)][n % 4];
    }
    if (f === 'exp') return Math.exp(a);
    if (f === 'log') {
        const safeA = Math.max(a, -0.99);
        if (n === 0) return Math.log(1 + safeA);
        return (Math.pow(-1, n - 1) * factorial(n - 1)) / Math.pow(1 + safeA, n);
    }
    return 0;
};

const targetFunc = (x: number, func: FunctionType): number => {
    if (func === 'sin') return Math.sin(x);
    if (func === 'exp') return Math.exp(x);
    if (func === 'log') return x > -1 ? Math.log(1 + x) : -5;
    return 0;
};

const polyFunc = (x: number, n: number, a: number, func: FunctionType): number => {
    let sum = 0;
    const safeA = func === 'log' ? Math.max(a, -0.99) : a;
    for (let i = 0; i <= n; i++) {
        const term = (getDeriv(func, i, safeA) / factorial(i)) * Math.pow(x - safeA, i);
        if (isFinite(term)) sum += term;
    }
    return sum;
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export default function TaylorRemainder() {
    const [n, setN] = useState(3);
    const [a, setA] = useState(0);
    const [probe, setProbe] = useState(2);
    const [func, setFunc] = useState<FunctionType>('sin');
    const model = useMemo(() => {
        const actual: LabVector[] = []; const polynomial: LabVector[] = []; const ribbon: LabVector[] = [];
        for (let index = 0; index <= 120; index++) {
            const x = -8 + 16 * index / 120;
            if (func === 'log' && x <= -1) continue;
            const f = clamp(targetFunc(x, func), -10, 10); const p = clamp(polyFunc(x, n, a, func), -10, 10);
            actual.push([x, f, 0]); polynomial.push([x, p, 0]);
            ribbon.push([x, p, 0], [x, f, clamp(Math.abs(f - p), 0, 15)]);
        }
        return { actual, polynomial, ribbon };
    }, [n, a, func]);
    const value = targetFunc(probe, func); const approximation = polyFunc(probe, n, a, func);
    const error = Math.abs(value - approximation);
    const surface: SpatialSurface = { vertices: model.ribbon, columns: 2, color: VIZ.error, opacity: 0.28 };
    return <VisualLab title="Taylor remainder" subtitle="A polynomial matches locally. Error grows as you move away from its expansion point."
        backUrl="/calculus" metrics={[{ label: 'Probe x', value: probe.toFixed(2) }, { label: 'f(x)', value: value.toFixed(4) },
            { label: 'Pₙ(x)', value: approximation.toFixed(4) }, { label: 'Exact |f − Pₙ|', value: error.toExponential(3) }]}
        legend={[{ label: 'f(x)', meaning: 'actual function', color: VIZ.truth, shape: 'line' }, { label: 'Pₙ(x)', meaning: 'Taylor output', color: VIZ.output, shape: 'line' },
            { label: 'Ribbon', meaning: 'displayed error extends into depth', color: VIZ.error, shape: 'square' }, { label: 'a', meaning: 'expansion point', color: VIZ.focus }]}
        controls={<><LabRange label="Degree" value={n} min={0} max={10} onChange={setN} />
            <LabRange label="Center" value={a} min={func === 'log' ? -0.9 : -3} max={3} step={0.1} decimals={1} onChange={setA} />
            <LabRange label="Probe x" value={probe} min={func === 'log' ? -0.9 : -6} max={6} step={0.1} decimals={1} onChange={setProbe} />
            <LabSelect label="Function" value={func} options={[{ value: 'sin', label: 'Sine wave' }, { value: 'exp', label: 'Exponential' }, { value: 'log', label: 'Logarithm ln(1+x)' }]}
                onChange={next => { setFunc(next as FunctionType); if (next === 'log') { if (a <= -1) setA(0); if (probe <= -1) setProbe(0); } }} /></>}
        insight={`At x = ${probe.toFixed(1)}, the degree-${n} approximation misses by ${error.toExponential(2)}. At the center a = ${a.toFixed(1)}, the function and polynomial agree. Stage heights clip at ±10; these readouts remain exact.`}
        challenge="Increase degree near the center, then move the probe far away. Does a better local match guarantee a better fit everywhere?"
        explanation={<div className="lab-explanation"><p>The polynomial is Σ f⁽ᵏ⁾(a)(x−a)ᵏ/k!. The exact probe readout uses the original function and polynomial before any display clipping.</p>
            <p>The stage clips function and polynomial heights to [−10,10]; ribbon depth is their displayed gap, capped at 15. For ln(1+x), only x &gt; −1 is drawn. A finite Taylor polynomial is a local approximation, not a global error bound.</p></div>}>
        <SpatialScene description="Actual function, Taylor polynomial, and a ribbon whose depth shows their displayed gap. The highlighted point is the expansion center."
            axes={['input x', 'function / polynomial height', 'displayed absolute error']} equalScale={false} paths={[{ points: model.actual, color: VIZ.truth, width: 3 }, { points: model.polynomial, color: VIZ.output, width: 3 }]}
            surfaces={[surface]} points={[{ position: [a, clamp(targetFunc(a, func), -10, 10), 0], color: VIZ.focus, radius: 0.14, label: 'a' },
                { position: [probe, clamp(value, -10, 10), 0], color: VIZ.data, radius: 0.1, label: 'x' }]}
            vectors={[{ from: [probe, clamp(approximation, -10, 10), 0], to: [probe, clamp(value, -10, 10), clamp(Math.abs(clamp(value,-10,10) - clamp(approximation,-10,10)), 0, 15)], color: VIZ.error }]} />
    </VisualLab>;
}
