import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, MeshDistortMaterial } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

function TransformingCube() {
    const meshRef = useRef<THREE.Mesh>(null!);
    const wireRef = useRef<THREE.LineSegments>(null!);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        const scaleX = 1 + Math.sin(t * 0.5) * 0.5;
        const scaleY = 1 + Math.cos(t * 0.7) * 0.3;
        const shear = Math.sin(t * 0.3) * 0.4;

        meshRef.current.scale.set(scaleX, scaleY, 1);
        meshRef.current.rotation.z = shear;

        wireRef.current.scale.copy(meshRef.current.scale);
        wireRef.current.rotation.copy(meshRef.current.rotation);
    });

    return (
        <group>
            <mesh ref={meshRef}>
                <boxGeometry args={[2, 2, 2]} />
                <MeshDistortMaterial
                    color="#6c5ce7"
                    roughness={0.3}
                    metalness={0.7}
                    opacity={0.6}
                    transparent
                    distort={0}
                    speed={0}
                />
            </mesh>
            <lineSegments ref={wireRef}>
                <edgesGeometry args={[new THREE.BoxGeometry(2, 2, 2)]} />
                <lineBasicMaterial color="#a29bfe" />
            </lineSegments>

            {/* Original ghost */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(2, 2, 2)]} />
                <lineBasicMaterial color="#333" transparent opacity={0.4} />
            </lineSegments>

            <gridHelper args={[10, 20, '#222', '#181828']} position={[0, -1.5, 0]} />
        </group>
    );
}

export default function MatrixTransformations() {
    const { topicId } = useParams<{ topicId: string }>();

    const controls = (
        <GlassPane>
            <div style={{ padding: '16px', color: 'white' }}>
                <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
                    Matrix Transformations
                </h3>
                <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        Watch how matrices transform objects through:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        <li>Scaling (changing size)</li>
                        <li>Rotation (changing orientation)</li>
                        <li>Shearing (skewing)</li>
                    </ul>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Gray wireframe shows original shape
                    </p>
                </div>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer
            backUrl={`/${topicId || 'linear-algebra'}`}
            controls={controls}
        >
            <SceneCanvas camera={{ position: [4, 3, 4], fov: 50 }} aria-label="Matrix Transformation Visualization">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, -3, 3]} intensity={0.5} color="#6c5ce7" />
                <TransformingCube />
                <OrbitControls enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#050508', 5, 15]} />
            </SceneCanvas>
        </SceneContainer>
    );
}
