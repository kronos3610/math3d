import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

function IntegralBars() {
    const groupRef = useRef<THREE.Group>(null!);
    const barCount = 24;

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        groupRef.current.children.forEach((child, i) => {
            if (child instanceof THREE.Mesh) {
                const x = (i / barCount) * 4 - 2;
                const height = Math.max(0.05, Math.sin(x + t * 0.5) * Math.cos(x * 0.5) + 1);
                child.scale.y = height;
                child.position.y = height / 2;
            }
        });
    });

    const bars = useMemo(() => {
        const result = [];
        const width = 4 / barCount;
        for (let i = 0; i < barCount; i++) {
            const x = (i / barCount) * 4 - 2 + width / 2;
            result.push(
                <mesh key={i} position={[x, 0.5, 0]}>
                    <boxGeometry args={[width * 0.9, 1, 0.6]} />
                    <meshStandardMaterial
                        color={`hsl(${175 + i * 3}, 70%, 50%)`}
                        roughness={0.3}
                        metalness={0.6}
                        transparent
                        opacity={0.8}
                    />
                </mesh>
            );
        }
        return result;
    }, []);

    return (
        <group ref={groupRef}>
            {bars}
            <gridHelper args={[8, 16, '#222', '#181828']} position={[0, 0, 0]} />
        </group>
    );
}

export default function Integrals() {
    const { topicId } = useParams<{ topicId: string }>();

    const controls = (
        <GlassPane>
            <div style={{ padding: '16px', color: 'white' }}>
                <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
                    Integrals
                </h3>
                <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        Watch animated Riemann sums approximate the area under curves
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#00cec9' }}>Cyan bars</span>: Rectangular approximations
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Integration finds the exact area as bar width approaches zero
                    </p>
                </div>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer
            backUrl={`/${topicId || 'calculus'}`}
            controls={controls}
        >
            <SceneCanvas camera={{ position: [3, 3, 4], fov: 50 }} aria-label="3D animated Riemann sum bars approximating area under a curve">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, 2, 3]} intensity={0.5} color="#00cec9" />
                <IntegralBars />
                <OrbitControls enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#050508', 5, 15]} />
            </SceneCanvas>
        </SceneContainer>
    );
}
