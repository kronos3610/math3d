import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useRef, useMemo, useEffect } from 'react';
import { useSceneFrame as useFrame } from '../../hooks/useSceneFrame';
import { OrbitControls, Line } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

export function DerivativeSurface() {
    const meshRef = useRef<THREE.Mesh>(null!);
    const tangentRef = useRef<THREE.Group>(null!);

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(6, 6, 48, 48);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            pos.setZ(i, Math.sin(x) * Math.cos(y) * 0.8);
        }
        geo.computeVertexNormals();
        return geo;
    }, []);

    useEffect(() => () => geometry.dispose(), [geometry]);
    useFrame((state) => {
        const t = state.clock.elapsedTime * 0.3;
        const x = Math.sin(t) * 2;
        const y = Math.cos(t) * 2;
        const z = Math.sin(x) * Math.cos(y) * 0.8;

        // Tangent point
        if (tangentRef.current) {
            tangentRef.current.position.set(x, y, z);
            tangentRef.current.rotation.y = -Math.atan(0.8 * Math.cos(x) * Math.cos(y));
        }
    });

    return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
            <mesh ref={meshRef} geometry={geometry}>
                <meshStandardMaterial
                    color="#00cec9"
                    roughness={0.4}
                    metalness={0.6}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.7}
                    wireframe={false}
                />
            </mesh>

            {/* Wireframe overlay */}
            <mesh geometry={geometry}>
                <meshBasicMaterial color="#00cec9" wireframe transparent opacity={0.15} />
            </mesh>

            {/* Moving tangent point */}
            <group ref={tangentRef} name="derivative-tangent" position={[0, 2, 0]} rotation={[0, -Math.atan(0.8 * Math.cos(2)), 0]}>
                <mesh>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshStandardMaterial color="#fdcb6e" emissive="#fdcb6e" emissiveIntensity={0.8} />
                </mesh>
                {/* Tangent line */}
                <Line
                    points={[[-0.8, 0, 0], [0.8, 0, 0]]}
                    color="#fd79a8"
                    lineWidth={3}
                />
            </group>
        </group>
    );
}

export default function Derivatives() {
    const { topicId } = useParams<{ topicId: string }>();

    const controls = (
        <GlassPane>
            <div style={{ padding: '16px', color: 'white' }}>
                <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
                    Derivatives
                </h3>
                <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        Function: z = 0.8 sin(x) × cos(y)
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fdcb6e' }}>Yellow dot</span>: Moving point on surface
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fd79a8' }}>Pink line</span>: Tangent line showing rate of change
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        The derivative represents the slope at each point
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
            <SceneCanvas frameloop="always" camera={{ position: [4, 3, 4], fov: 50 }} aria-label="3D surface showing the x derivative as a tangent on z = 0.8 sin(x) cos(y)">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, 2, 3]} intensity={0.5} color="#00cec9" />
                <DerivativeSurface />
                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#050508', 5, 15]} />
            </SceneCanvas>
        </SceneContainer>
    );
}
