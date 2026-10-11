import { VIZ } from '../../data/palette';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useSceneFrame as useFrame } from '../../hooks/useSceneFrame';
import { useFrame as useDataFrame, useThree } from '@react-three/fiber';
import { useSceneMotion } from '../../hooks/useSceneMotion';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';
import { Split, Combine } from 'lucide-react';

const PIECE_COUNT = 5;
const COLORS = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6];
const SPHERE_RADIUS = 2;

interface SpherePieceProps {
    pieceId: number;
    setIndex: number;
    animationProgress: React.MutableRefObject<number>;
}

function SpherePiece({ pieceId, setIndex, animationProgress }: SpherePieceProps) {
    const meshRef = useRef<THREE.Mesh>(null!);

    const geometry = useMemo(() => {
        const angleWidth = (Math.PI * 2) / PIECE_COUNT;
        const startAngle = pieceId * angleWidth;
        return new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32, startAngle, angleWidth);
    }, [pieceId]);

    const startPos = useMemo(() => new THREE.Vector3(0, 0, 0), []);
    const targetPos = useMemo(
        () => new THREE.Vector3(setIndex === 0 ? -4.5 : 4.5, 0, 0),
        [setIndex]
    );

    const startRot = useMemo(() => new THREE.Euler(0, 0, 0), []);
    const targetRot = useMemo(
        () =>
            new THREE.Euler(
                setIndex === 0 ? 0 : Math.PI,
                setIndex === 0 ? 0 : Math.PI / 2,
                0
            ),
        [setIndex]
    );

    useEffect(() => () => geometry.dispose(), [geometry]);
    useDataFrame(() => {
        if (!meshRef.current) return;

        const progress = animationProgress.current;

        // Position interpolation
        meshRef.current.position.lerpVectors(startPos, targetPos, progress);

        // Rotation interpolation
        meshRef.current.rotation.x = THREE.MathUtils.lerp(
            startRot.x,
            targetRot.x,
            progress
        );
        meshRef.current.rotation.y = THREE.MathUtils.lerp(
            startRot.y,
            targetRot.y,
            progress
        );
        meshRef.current.rotation.z = THREE.MathUtils.lerp(
            startRot.z,
            targetRot.z,
            progress
        );

        // Subtle scaling effect during transition
        const s = 1 + Math.sin(progress * Math.PI) * 0.1;
        meshRef.current.scale.set(s, s, s);

    });

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshPhongMaterial
                color={COLORS[pieceId]}
                shininess={80}
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

export function BanachTarskiScene({ animationProgress }: { animationProgress: React.MutableRefObject<number> }) {
    const sceneRef = useRef<THREE.Group>(null!);

    useFrame(() => {
        if (sceneRef.current) {
            sceneRef.current.rotation.y += 0.003;
        }
    });

    return (
        <group ref={sceneRef}>
            {Array.from({ length: PIECE_COUNT }, (_, i) => (
                <group key={i}>
                    <SpherePiece
                        pieceId={i}
                        setIndex={0}
                        animationProgress={animationProgress}
                    />
                    <SpherePiece
                        pieceId={i}
                        setIndex={1}
                        animationProgress={animationProgress}
                    />
                </group>
            ))}
        </group>
    );
}

export function AnimationController({
    isSplit,
    progressRef,
}: {
    isSplit: boolean;
    progressRef: React.MutableRefObject<number>;
}) {
    const moving = useSceneMotion();
    const invalidate = useThree(state => state.invalidate);
    useLayoutEffect(() => {
        if (!moving) { progressRef.current = isSplit ? 1 : 0; invalidate(); }
    }, [moving, isSplit, progressRef, invalidate]);
    useFrame(() => {
        const target = isSplit ? 1 : 0;
        progressRef.current += (target - progressRef.current) * 0.06;
    });

    return null;
}

export default function BanachTarski() {
    const { topicId } = useParams();
    const [isSplit, setIsSplit] = useState(false);
    const animationProgressRef = useRef(0);

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white' }}>Banach-Tarski Paradox</h1>
                <p style={{ fontSize: '12px', color: VIZ.axis, lineHeight: 1.6 }}>
                    A schematic illustration of a theorem about non-measurable sets.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                    onClick={() => setIsSplit(false)}
                    disabled={!isSplit}
                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: !isSplit ? VIZ.grid : '#334155', color: !isSplit ? VIZ.axis : 'white', fontSize: '13px', fontWeight: 600, cursor: isSplit ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isSplit ? 1 : 0.5 }}
                >
                    <Combine size={16} /> Unify Sphere
                </button>
                <button
                    onClick={() => setIsSplit(true)}
                    disabled={isSplit}
                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: isSplit ? VIZ.grid : '#3b82f6', color: 'white', fontSize: '13px', fontWeight: 600, cursor: !isSplit ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !isSplit ? 1 : 0.5 }}
                >
                    <Split size={16} /> Decompose & Double
                </button>
            </div>

            <GlassPane style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '14px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: VIZ.variation, marginBottom: '6px' }}>How is this possible?</h4>
                <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    The theorem uses the <strong>Axiom of Choice</strong> to partition a ball into finitely many non-measurable sets that can be rearranged by rigid motions into two equal balls. The rendered patches are ordinary surfaces drawn in two copies to illustrate the conclusion. This animation does not construct those sets or physically duplicate a ball.
                </p>
            </GlassPane>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls} legend={[{ label: 'Colored patches', meaning: 'ordinary rendered pieces in a schematic', color: VIZ.variation, shape: 'square' }, { label: 'Two balls', meaning: 'illustrated conclusion; no physical duplication', color: VIZ.data }]}>
            <SceneCanvas frameloop="always" camera={{ position: [0, 2, 12], fov: 60 }} style={{ width: '100%', height: '100%' }} aria-label="Schematic animation of the Banach-Tarski conclusion using duplicated ordinary surface patches; not a construction of the theorem">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 7.5]} intensity={0.8} />
                <pointLight position={[-5, -5, 5]} color="#3b82f6" intensity={0.5} />

                <BanachTarskiScene animationProgress={animationProgressRef} />
                <AnimationController isSplit={isSplit} progressRef={animationProgressRef} />

                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={[VIZ.background, 8, 25]} />
                <color attach="background" args={[VIZ.background]} />
            </SceneCanvas>
        </SceneContainer>
    );
}
