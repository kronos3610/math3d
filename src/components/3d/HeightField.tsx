import { useEffect, useMemo } from 'react';
import { DoubleSide } from 'three';
import { VIZ } from '../../data/palette';
import { heightFieldGeometry, sampleHeightField } from './height-field-geometry';

export interface HeightFieldProps {
    f: (x: number, y: number) => number;
    /** Full width of the square input domain, centered at the origin. */
    extent: number;
    resolution?: number;
    color?: string;
    wireframe?: boolean;
    opacity?: number;
}

export function HeightField({ f, extent, resolution = 48, color = VIZ.data, wireframe = false, opacity = 0.45 }: HeightFieldProps) {
    const geometry = useMemo(() => heightFieldGeometry(sampleHeightField(f, extent, resolution)), [f, extent, resolution]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <mesh name="height-field" geometry={geometry}>
        <meshLambertMaterial color={color} wireframe={wireframe} side={DoubleSide} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>;
}
