import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

function RotatingCube() {
    const meshRef = useRef<THREE.Mesh>(null!);

    useFrame(() => {
        meshRef.current.rotation.x += 0.01;
        meshRef.current.rotation.y += 0.01;
    });

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#ff0080" emissive="#ff0080" emissiveIntensity={0.2} />
        </mesh>
    );
}

export default function SimpleTest() {
    const { topicId } = useParams<{ topicId: string }>();

    const controls = (
        <GlassPane>
            <div style={{ padding: '16px', color: 'white' }}>
                <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
                    Simple WebGL Test
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                    You should see a bright pink rotating cube. If you see this text but no cube, check the console for errors.
                </p>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer
            backUrl={`/${topicId || 'linear-algebra'}`}
            controls={controls}
        >
            <SceneCanvas
                camera={{ position: [5, 5, 5], fov: 45 }}
                gl={{ antialias: true, alpha: false }}
                dpr={[1, 2]}
                aria-label="Simple WebGL test scene with a rotating cube"
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <RotatingCube />
                <OrbitControls />
            </SceneCanvas>
        </SceneContainer>
    );
}
