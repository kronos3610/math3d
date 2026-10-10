import { Html } from '@react-three/drei';

interface LabelProps {
    text: string;
    position: [number, number, number];
    color: string;
    fontSize?: number;
    outlineWidth?: number; // Ignored in Html
    outlineColor?: string; // Ignored in Html
}

export function Label({
    text,
    position,
    color,
    fontSize = 0.5,
}: LabelProps) {
    return (
        <Html position={position} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{
                color: color,
                fontFamily: 'Inter, sans-serif',
                fontSize: `${fontSize * 24}px`, // Approximate scaling
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                pointerEvents: 'none'
            }}>
                {text}
            </div>
        </Html>
    );
}
