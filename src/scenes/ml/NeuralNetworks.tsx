import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { getNeuronPositions } from '../../utils/neural-network';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';

function NeuronLayer({ count, x, color }: { count: number; x: number; color: string }) {
    const neurons = getNeuronPositions(count, x);
    return (
        <>
            {neurons.map((pos, i) => (
                <Sphere key={i} args={[0.18, 16, 16]} position={pos}>
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.3} metalness={0.7} />
                </Sphere>
            ))}
        </>
    );
}

function Connections({ fromPositions, toPositions, color }: { fromPositions: [number, number, number][]; toPositions: [number, number, number][]; color: string }) {
    const lines = useMemo(() => {
        const result: { from: [number, number, number]; to: [number, number, number] }[] = [];
        for (const from of fromPositions) {
            for (const to of toPositions) {
                result.push({ from, to });
            }
        }
        return result;
    }, [fromPositions, toPositions]);

    return (
        <>
            {lines.map((line, i) => (
                <Line key={i} points={[line.from, line.to]} color={color} lineWidth={0.5} transparent opacity={0.3} />
            ))}
        </>
    );
}

function AnimatedPulse({ isPlaying }: { isPlaying: boolean }) {
    const ref = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        if (!isPlaying) return;
        const t = state.clock.elapsedTime;
        const x = -3 + ((t * 1.5) % 9) - 1;
        ref.current.position.x = x;
        ref.current.position.y = Math.sin(t * 2) * 0.5;
        const scale = 0.1 + Math.sin(t * 3) * 0.02;
        ref.current.scale.setScalar(scale / 0.1);
    });

    return (
        <Sphere ref={ref} args={[0.1, 16, 16]}>
            <meshStandardMaterial color="#fdcb6e" emissive="#fdcb6e" emissiveIntensity={1.5} />
        </Sphere>
    );
}

function NetworkScene({ isPlaying }: { isPlaying: boolean }) {
    const groupRef = useRef<THREE.Group>(null!);

    useFrame((state) => {
        if (isPlaying) {
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.3;
        }
    });

    const layers = [
        { count: 3, x: -3, color: '#fdcb6e' },
        { count: 5, x: -1, color: '#fd79a8' },
        { count: 5, x: 1, color: '#6c5ce7' },
        { count: 2, x: 3, color: '#00cec9' },
    ];

    return (
        <group ref={groupRef}>
            {layers.map((layer, i) => (
                <NeuronLayer key={i} count={layer.count} x={layer.x} color={layer.color} />
            ))}
            {layers.slice(0, -1).map((layer, i) => (
                <Connections
                    key={i}
                    fromPositions={getNeuronPositions(layer.count, layer.x)}
                    toPositions={getNeuronPositions(layers[i + 1].count, layers[i + 1].x)}
                    color="#444"
                />
            ))}
            <AnimatedPulse isPlaying={isPlaying} />
        </group>
    );
}

export default function NeuralNetworks() {
    const { topicId } = useParams();
    const [isPlaying, setIsPlaying] = useState(true);

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white', margin: 0 }}>Neural Network</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>Feed Forward</p>
            </div>

            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
                Visualizing signal propagation through a multi-layer perceptron.
            </div>

            <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: isPlaying ? '#ec4899' : '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? 'Pause Animation' : 'Resume Animation'}
            </button>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas camera={{ position: [0, 0, 8], fov: 50 }} style={{ width: '100%', height: '100%' }} aria-label="3D visualization of a feed-forward neural network with signal propagation">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 5]} intensity={0.8} />
                <NetworkScene isPlaying={isPlaying} />
                <OrbitControls enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#0b0f19', 6, 18]} />
                <color attach="background" args={['#0b0f19']} />
            </SceneCanvas>
        </SceneContainer>
    );
}
