import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useMemo, useLayoutEffect, useRef, useEffect } from 'react';

import { OrbitControls } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

function GaussianSurface() {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(8, 8, 64, 64);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = 2 * Math.exp(-(x * x + y * y) / 2);
            pos.setZ(i, z);
        }
        geo.computeVertexNormals();
        return geo;
    }, []);


    useEffect(() => () => geometry.dispose(), [geometry]);
    return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
            <mesh geometry={geometry}>
                <meshStandardMaterial
                    color="#fd79a8"
                    roughness={0.3}
                    metalness={0.6}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.7}
                />
            </mesh>
            <mesh geometry={geometry}>
                <meshBasicMaterial color="#fd79a8" wireframe transparent opacity={0.12} />
            </mesh>
        </group>
    );
}

const SAMPLE_POINTS = (() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 80; i++) {
        const u1 = Math.max(Math.random(), Number.MIN_VALUE);
        const u2 = Math.random();
        const x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
        const y = 2 * Math.exp(-(x * x + z * z) / 2) + 0.05;
        pts.push([x, y, z]);
    }
    return pts;
})();

function SamplePoints() {
    const mesh = useRef<THREE.InstancedMesh>(null);
    useLayoutEffect(() => {
        if (!mesh.current) return;
        const matrix = new THREE.Matrix4();
        SAMPLE_POINTS.forEach((position, index) => {
            matrix.makeTranslation(...position);
            mesh.current!.setMatrixAt(index, matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
        mesh.current.computeBoundingSphere();
    }, []);
    return <instancedMesh ref={mesh} args={[undefined, undefined, SAMPLE_POINTS.length]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#fdcb6e" emissive="#fdcb6e" emissiveIntensity={0.6} />
    </instancedMesh>;
}

export default function Distributions() {
    const { topicId } = useParams<{ topicId: string }>();

    const controls = (
        <GlassPane>
            <div style={{ padding: '16px', color: 'white' }}>
                <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
                    Probability Distributions
                </h3>
                <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fd79a8' }}>Pink surface</span>: Scaled standard 2D Gaussian density
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fdcb6e' }}>Yellow dots</span>: Random samples from the distribution
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Surface height is 4π times the density for visibility. The horizontal coordinates are Gaussian samples; their heights are placed on the surface, not a third random variable.
                    </p>
                </div>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer
            backUrl={`/${topicId || 'probability'}`}
            controls={controls}
        >
            <SceneCanvas frameloop="demand" camera={{ position: [4, 4, 4], fov: 50 }} aria-label="3D Gaussian probability distribution surface with random sample points">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, 2, 3]} intensity={0.5} color="#fd79a8" />
                <GaussianSurface />
                <SamplePoints />
                <gridHelper args={[8, 16, '#222', '#181828']} position={[0, -0.01, 0]} />
                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#050508', 5, 15]} />
            </SceneCanvas>
        </SceneContainer>
    );
}
