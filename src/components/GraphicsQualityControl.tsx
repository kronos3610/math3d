import { useId } from 'react';
import { setGraphicsQuality, useGraphicsQuality, type GraphicsQuality } from '../hooks/useGraphicsQuality';

export default function GraphicsQualityControl() {
    const id = useId();
    const quality = useGraphicsQuality();
    return <div className="graphics-quality-control">
        <label htmlFor={id}>Graphics quality</label>
        <select id={id} value={quality} onChange={event => setGraphicsQuality(event.target.value as GraphicsQuality)}>
            <option value="light">Light · fewer pixels, no shadows</option>
            <option value="detailed">Detailed · sharper pixels and shadows</option>
        </select>
        <p>The mathematical content stays the same. Light is the default for smoother 3D interaction.</p>
    </div>;
}
