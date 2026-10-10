import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useMemo, useRef, useLayoutEffect, useEffect } from 'react';

import { OrbitControls } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

const POINTS = (() => {
    const pts: { pos: [number, number, number]; classId: number }[] = [];
    // Class 0 cluster
    for (let i = 0; i < 40; i++) {
        pts.push({
            pos: [
                -1.5 + (Math.random() - 0.5) * 2,
                -1 + (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
            ],
            classId: 0,
        });
    }
    // Class 1 cluster
    for (let i = 0; i < 40; i++) {
        pts.push({
            pos: [
                1.5 + (Math.random() - 0.5) * 2,
                1 + (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
            ],
            classId: 1,
        });
    }
    return pts;
})();

const POINTS_0 = POINTS.filter((p) => p.classId === 0);
const POINTS_1 = POINTS.filter((p) => p.classId === 1);

function InstancedPoints({
    points,
    color,
}: {
    points: typeof POINTS;
    color: string;
}) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const temp = useMemo(() => new THREE.Object3D(), []);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        points.forEach((pt, i) => {
            temp.position.set(...pt.pos);
            temp.updateMatrix();
            meshRef.current!.setMatrixAt(i, temp.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [points, temp]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, points.length]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
            />
        </instancedMesh>
    );
}

function DataPoints() {
    return (
        <>
            <InstancedPoints points={POINTS_0} color="#fdcb6e" />
            <InstancedPoints points={POINTS_1} color="#6c5ce7" />
        </>
    );
}

const BOUNDARY_ORIENTATION = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1.5, 1, 0).normalize());

export function DecisionPlane() {
    return (
        <mesh quaternion={BOUNDARY_ORIENTATION.toArray()}>
            <planeGeometry args={[8, 8]} />
            <meshStandardMaterial
                color="#00cec9"
                transparent
                opacity={0.1}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

function DecisionPlaneEdge() {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(8, 8);
        const edges = new THREE.EdgesGeometry(geo);
        geo.dispose();
        return edges;
    }, []);

    useEffect(() => () => geometry.dispose(), [geometry]);
    return (
        <lineSegments quaternion={BOUNDARY_ORIENTATION.toArray()} geometry={geometry}>
            <lineBasicMaterial color="#00cec9" transparent opacity={0.3} />
        </lineSegments>
    );
}

export default function DecisionBoundaries() {
    const { topicId } = useParams<{ topicId: string }>();

    const controls = (
        <GlassPane>
            <div style={{ padding: '16px', color: 'white' }}>
                <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
                    Decision Boundaries
                </h3>
                <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#fdcb6e' }}>Yellow dots</span>: Class 0 data points
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#6c5ce7' }}>Purple dots</span>: Class 1 data points
                    </p>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                        <span style={{ color: '#00cec9' }}>Cyan plane</span>: Decision boundary
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Fixed example rule: score = 1.5x + y. The plane is score = 0; these two synthetic clusters lie on opposite sides. This view does not train a classifier.
                    </p>
                </div>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer
            backUrl={`/${topicId || 'ml'}`}
            controls={controls}
        >
            <SceneCanvas frameloop="demand" camera={{ position: [4, 3, 4], fov: 50 }} aria-label="3D visualization of classifier decision boundary separating two point clusters">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, 2, 3]} intensity={0.5} color="#fdcb6e" />
                <DataPoints />
                <DecisionPlane />
                <DecisionPlaneEdge />
                <gridHelper args={[8, 16, '#222', '#181828']} position={[0, -3, 0]} />
                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#050508', 5, 15]} />
            </SceneCanvas>
        </SceneContainer>
    );
}
