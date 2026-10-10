import { useEffect, useRef } from 'react';
import { useKatex } from '../hooks/useKatex';

export interface LatexProps {
    formula: string;
    display?: boolean;
}

export default function Latex({ formula, display = false }: LatexProps) {
    const containerRef = useRef<HTMLSpanElement>(null);
    const isKatexLoaded = useKatex();

    useEffect(() => {
        if (containerRef.current && isKatexLoaded && window.katex) {
            window.katex.render(formula, containerRef.current, {
                throwOnError: false,
                displayMode: display,
            });
        }
    }, [formula, display, isKatexLoaded]);

    return (
        <span
            ref={containerRef}
            style={{
                display: display ? 'block' : 'inline-block',
                margin: display ? '16px 0' : '0',
                textAlign: display ? 'center' : 'left',
                overflowX: 'auto',
            }}
        >{formula}</span>
    );
}
