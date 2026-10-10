import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { FitSceneCamera } from '../../components/3d/FitSceneCamera';
import { useState, useMemo, useRef, useEffect, useLayoutEffect, type ComponentRef } from 'react';
import { useSceneMotion } from '../../hooks/useSceneMotion';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
    RotateCw,
    RefreshCcw,
} from 'lucide-react';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';
import { SceneAxisKey } from '../../components/3d/SceneAxisKey';

const SURFACE_CAMERA = { position: [8, 6, 8] as [number, number, number], fov: 50 };
const SURFACE_BOUNDS = { minimum: [-4.9, -2.3, -4.9] as const, maximum: [4.9, 3.3, 4.9] as const };

// --- Mathematical Functions ---
// z = sin(x) * cos(y)
const f = (x: number, y: number) => Math.sin(x) * Math.cos(y);

const df_dx = (x: number, y: number) => Math.cos(x) * Math.cos(y);

const df_dy = (x: number, y: number) => -Math.sin(x) * Math.sin(y);

// --- Constants & Config ---
const CONF = {
    colorSurface: '#3b82f6', // Blue-500
    colorX: '#f43f5e',       // Rose-500
    colorY: '#10b981',       // Emerald-500
    colorGrad: '#facc15',    // Yellow-400
    colorLift: '#f97316',    // Orange-500
    floorY: -2.0,
    axisLength: 4
};

// --- Sub-components (Unchanged Math Logic) ---

function RigorousSurface() {
    const geometry = useMemo(() => {
        const size = 6; // Domain -3 to 3 in both input directions
        const res = 80;
        const geo = new THREE.PlaneGeometry(size, size, res, res);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = f(x, y);
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
                    color={CONF.colorSurface}
                    roughness={0.4}
                    metalness={0.1}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.8}
                />
            </mesh>
            <mesh geometry={geometry}>
                <meshBasicMaterial color="#000000" wireframe transparent opacity={0.1} />
            </mesh>
        </group>
    );
}

function BaseGrid() {
    return (
        <gridHelper
            args={[10, 20, '#475569', '#1e293b']}
            position={[0, CONF.floorY, 0]}
        />
    );
}

function VectorSystem({ x, y }: { x: number; y: number }) {
    const z = f(x, y);
    const dx = df_dx(x, y);
    const dy = df_dy(x, y);
    const gradMag = Math.sqrt(dx * dx + dy * dy);

    const pointPos = new THREE.Vector3(x, z, y);
    const floorPos = new THREE.Vector3(x, CONF.floorY, y);

    const tanXDir = new THREE.Vector3(1, dx, 0).normalize();
    const tanYDir = new THREE.Vector3(0, dy, 1).normalize();
    const floorGradDir = new THREE.Vector3(dx, 0, dy).normalize();

    const rise = gradMag * gradMag;
    const liftedDir = new THREE.Vector3(dx, rise, dy).normalize();

    return (
        <group>
            <Line points={[pointPos, floorPos]} color="#94a3b8" dashed dashSize={0.2} gapSize={0.1} opacity={0.5} transparent />
            <mesh position={pointPos}><sphereGeometry args={[0.12, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
            <mesh position={floorPos}><sphereGeometry args={[0.08, 16, 16]} /><meshBasicMaterial color="#94a3b8" /></mesh>
            <ArrowHelper dir={tanXDir} origin={pointPos} len={1.0} color={CONF.colorX} width={0.15} />
            <ArrowHelper dir={tanYDir} origin={pointPos} len={1.0} color={CONF.colorY} width={0.15} />
            {gradMag > 0.001 && <ArrowHelper dir={floorGradDir} origin={floorPos} len={gradMag} color={CONF.colorGrad} width={0.25} />}
            {gradMag > 0.001 && <ArrowHelper dir={liftedDir} origin={pointPos} len={1.8} color={CONF.colorLift} width={0.2} />}
            <TangentPlane x={x} y={y} z={z} dx={dx} dy={dy} />
        </group>
    );
}

function ArrowHelper({ dir, origin, len, color, width }: { dir: THREE.Vector3, origin: THREE.Vector3, len: number, color: string, width: number }) {
    return (
        <group position={origin} rotation={new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))}>
            <mesh position={[0, len / 2, 0]}>
                <cylinderGeometry args={[width * 0.3, width * 0.3, len, 8]} />
                <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <mesh position={[0, len, 0]}>
                <coneGeometry args={[width, width * 2.5, 16]} />
                <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
        </group>
    );
}

function TangentPlane({ x, y, z, dx, dy }: { x: number, y: number, z: number, dx: number, dy: number }) {
    const planeRef = useRef<THREE.Mesh>(null);

    useLayoutEffect(() => {
        const normal = new THREE.Vector3(-dx, 1, -dy).normalize();
        if (planeRef.current) {
            planeRef.current.position.set(x, z, y);
            planeRef.current.lookAt(x + normal.x, z + normal.y, y + normal.z);
            planeRef.current.position.addScaledVector(normal, 0.02);
        }
    }, [x, y, z, dx, dy]);

    return (
        <mesh ref={planeRef}>
            <planeGeometry args={[2.5, 2.5]} />
            <meshPhongMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.15} shininess={100} depthWrite={false} />
        </mesh>
    );
}

function RigorousAxes() {
    return (
        <group>
            <Line points={[new THREE.Vector3(-CONF.axisLength, 0, 0), new THREE.Vector3(CONF.axisLength, 0, 0)]} color={CONF.colorX} lineWidth={2} opacity={0.5} transparent />
            <Html position={[CONF.axisLength + 0.2, 0, 0]} center zIndexRange={[40, 0]} pointerEvents="none"><div style={{ color: CONF.colorX, fontWeight: 'bold' }}>X</div></Html>
            <Line points={[new THREE.Vector3(0, 0, -CONF.axisLength), new THREE.Vector3(0, 0, CONF.axisLength)]} color={CONF.colorY} lineWidth={2} opacity={0.5} transparent />
            <Html position={[0, 0, CONF.axisLength + 0.2]} center zIndexRange={[40, 0]} pointerEvents="none"><div style={{ color: CONF.colorY, fontWeight: 'bold' }}>Y</div></Html>
        </group>
    );
}

function CameraController({ autoRotate, reset }: { autoRotate: boolean, reset: number }) {
    const moving = useSceneMotion();
    const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
    useEffect(() => {
        if (reset > 0 && controlsRef.current) controlsRef.current.reset();
    }, [reset]);
    return <OrbitControls ref={controlsRef} makeDefault autoRotate={moving && autoRotate} autoRotateSpeed={2.0} enableDamping dampingFactor={0.05} />;
}

// --- Main Component ---

export default function PartialDerivatives() {
    const { topicId } = useParams();
    const moving = useSceneMotion();
    const [coords, setCoords] = useState({ x: 0.5, y: 0.5 });
    const [autoRotate, setAutoRotate] = useState(true);
    const [resetCount, setResetCount] = useState(0);

    const dx = df_dx(coords.x, coords.y);
    const dy = df_dy(coords.x, coords.y);
    const gradMag = Math.sqrt(dx * dx + dy * dy);

    // Define Controls Content
    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white' }}>Calculus Visualizer</h1>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>z = sin(x) · cos(y)</p>
            </div>

            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                    <span>Coordinate X</span><span style={{ color: 'white' }}>{coords.x.toFixed(2)}</span>
                </div>
                <input aria-label="Coordinate X" type="range" min="-3" max="3" step="0.1" value={coords.x} onChange={(e) => { setCoords(p => ({ ...p, x: parseFloat(e.target.value) })); setAutoRotate(false); }} style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }} />
            </div>

            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                    <span>Coordinate Y</span><span style={{ color: 'white' }}>{coords.y.toFixed(2)}</span>
                </div>
                <input aria-label="Coordinate Y" type="range" min="-3" max="3" step="0.1" value={coords.y} onChange={(e) => { setCoords(p => ({ ...p, y: parseFloat(e.target.value) })); setAutoRotate(false); }} style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }} />
            </div>

            <GlassPane style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderLeft: '2px solid #6366f1' }}>
                <MathRow label="∂f/∂x" val={dx.toFixed(2)} color={CONF.colorX} />
                <MathRow label="∂f/∂y" val={dy.toFixed(2)} color={CONF.colorY} />
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }}></div>
                <MathRow label="∇f (2D)" val={gradMag.toFixed(2)} color={CONF.colorGrad} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: CONF.colorLift, marginRight: 8 }}></span>Tangent Gradient</span>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fb923c' }}>STEEPEST ASCENT</span>
                </div>
            </GlassPane>

            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setAutoRotate(!autoRotate)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #334155', background: autoRotate ? '#6366f1' : '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><RotateCw size={14} />{autoRotate ? 'On' : 'Off'}</button>
                <button onClick={() => { setResetCount(c => c + 1); setAutoRotate(false); setCoords({ x: 0.5, y: 0.5 }); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><RefreshCcw size={14} />Reset</button>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas frameloop={moving && autoRotate ? 'always' : 'demand'} dpr={[1, 1.5]} shadows camera={SURFACE_CAMERA} aria-label="3D visualization of partial derivatives showing how functions change along individual axes">
                <FitSceneCamera bounds={SURFACE_BOUNDS} />
                <color attach="background" args={['#0b0f19']} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 10, 5]} intensity={1.0} />

                <BaseGrid />
                <RigorousSurface />
                <RigorousAxes />
                <VectorSystem x={coords.x} y={coords.y} />

                <CameraController autoRotate={autoRotate} reset={resetCount} />
            </SceneCanvas>
            <SceneAxisKey axes={[{ label: 'X', meaning: 'input x', color: CONF.colorX }, { label: 'Y', meaning: 'input y on the floor', color: CONF.colorY }, { label: 'Height', meaning: 'z = f(x, y)', color: CONF.colorSurface }]} />
        </SceneContainer>
    );
}

function MathRow({ label, val, color }: { label: string, val: string, color: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color, marginRight: 8 }}></span>{label}</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: color === CONF.colorX ? '#f87171' : color === CONF.colorY ? '#34d399' : '#facc15' }}>{val}</span>
        </div>
    )
}
