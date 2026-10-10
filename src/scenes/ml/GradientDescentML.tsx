import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useMemo, useState } from 'react';

import { OrbitControls } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

import { DescentTrajectory } from '../../components/3d/DescentTrajectory';
import { gradientDescentPath, nonconvexLoss, nonconvexGradient } from '../../utils/optimization';

const descentPath = gradientDescentPath(nonconvexGradient, [3, 2]);

function LossLandscape() {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(8, 8, 64, 64);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = nonconvexLoss(x, y);
            pos.setZ(i, z);
        }
        geo.computeVertexNormals();
        return geo;
    }, []);

    return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
            <mesh geometry={geometry}>
                <meshStandardMaterial
                    color="#fdcb6e"
                    roughness={0.4}
                    metalness={0.5}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.5}
                />
            </mesh>
            <mesh geometry={geometry}>
                <meshBasicMaterial color="#f39c12" wireframe transparent opacity={0.08} />
            </mesh>
        </group>
    );
}

export default function GradientDescentML() {
    const { topicId } = useParams<{ topicId: string }>();

    const [playing, setPlaying] = useState(true);
    const [resetCount, setResetCount] = useState(0);

    const controls = (
        <GlassPane>
            <div style={{ padding: '16px', color: 'white' }}>
                <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
                    Gradient Descent
                </h3>
                <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fdcb6e' }}>Gold surface</span>: Multi-modal loss landscape with local minima
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fd79a8' }}>Pink ball</span>: Parameter vector following gradient descent
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fd79a8' }}>Pink trail</span>: Computed optimization trajectory
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Each update subtracts 0.1 times the gradient. The path converges to a stationary point of this non-convex loss; it is not guaranteed to find the global minimum.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" className="scene-panel-tab" onClick={() => setPlaying(p => !p)}>{playing ? 'Pause' : 'Resume'}</button>
                    <button type="button" className="scene-panel-tab" onClick={() => setResetCount(n => n + 1)}>Reset</button>
                </div>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <SceneCanvas camera={{ position: [5, 5, 5], fov: 50 }} style={{ width: '100%', height: '100%' }} aria-label="3D visualization of gradient descent on a non-convex loss landscape">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, 2, 3]} intensity={0.5} color="#fdcb6e" />
                <LossLandscape />
                <DescentTrajectory key={resetCount} path={descentPath} loss={nonconvexLoss} playing={playing} color="#fd79a8" />
                <OrbitControls enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#0b0f19', 6, 18]} />
                <color attach="background" args={['#0b0f19']} />
            </SceneCanvas>
        </SceneContainer>
    );
}
