import { SceneCanvas } from './3d/SceneCanvas';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Torus, Box } from '@react-three/drei';
import * as THREE from 'three';

function RotatingTorus() {
    const ref = useRef<THREE.Mesh>(null!);
    useFrame((_, delta) => {
        ref.current.rotation.x += delta * 0.3;
        ref.current.rotation.y += delta * 0.2;
    });

    return (
        <Torus ref={ref} args={[1.2, 0.4, 32, 64]} position={[-2, 0.5, -1]}>
            <MeshDistortMaterial
                color="#6c5ce7"
                roughness={0.2}
                metalness={0.8}
                distort={0.2}
                speed={2}
            />
        </Torus>
    );
}

function FloatingSphere() {
    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1.5}>
            <Sphere args={[0.8, 64, 64]} position={[2, -0.5, 0]}>
                <MeshDistortMaterial
                    color="#00cec9"
                    roughness={0.1}
                    metalness={0.9}
                    distort={0.3}
                    speed={3}
                />
            </Sphere>
        </Float>
    );
}

function FloatingCube() {
    const ref = useRef<THREE.Mesh>(null!);
    useFrame((_, delta) => {
        ref.current.rotation.x += delta * 0.2;
        ref.current.rotation.z += delta * 0.15;
    });

    return (
        <Float speed={1.5} rotationIntensity={0.3} floatIntensity={1}>
            <Box ref={ref} args={[0.8, 0.8, 0.8]} position={[0, 1.5, -2]}>
                <MeshDistortMaterial
                    color="#fd79a8"
                    roughness={0.3}
                    metalness={0.7}
                    distort={0.15}
                    speed={2}
                />
            </Box>
        </Float>
    );
}

function SmallSphere({ position, color }: { position: [number, number, number]; color: string }) {
    return (
        <Float speed={3} rotationIntensity={0} floatIntensity={2}>
            <Sphere args={[0.15, 32, 32]} position={position}>
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </Sphere>
        </Float>
    );
}

function Particles() {
    const particlePositions: [number, number, number][] = [
        [-3, 2, -3], [3, -1, -2], [-1, -2, -1], [2, 2, -3],
        [-2, -1, -4], [1, 1, -2], [-3, 0, -2], [3, 1, -4],
    ];
    const colors = ['#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e'];

    return (
        <>
            {particlePositions.map((pos, i) => (
                <SmallSphere key={i} position={pos} color={colors[i % colors.length]} />
            ))}
        </>
    );
}

export default function HeroScene() {
    return (
        <SceneCanvas aria-hidden="true" fallback={null} frameloop="always" camera={{ position: [0, 0, 5], fov: 60 }}>
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <pointLight position={[-5, -5, 5]} intensity={0.5} color="#6c5ce7" />
            <pointLight position={[5, -5, 5]} intensity={0.5} color="#00cec9" />

            <RotatingTorus />
            <FloatingSphere />
            <FloatingCube />
            <Particles />

            <fog attach="fog" args={['#050508', 4, 12]} />
        </SceneCanvas>
    );
}
