import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { FitSceneCamera } from '../../components/3d/FitSceneCamera';
import { useState, useMemo, useRef, useEffect, type ComponentRef } from 'react';
import { useSceneMotion } from '../../hooks/useSceneMotion';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCw, RefreshCcw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { Arrow } from '../../components/3d/Arrow';
import { SceneAxisKey } from '../../components/3d/SceneAxisKey';

const SURFACE_CAMERA = { position: [5, 5, 5] as [number, number, number], fov: 75 };
const SURFACE_BOUNDS = { minimum: [-4.1, -1.6, -4.1] as const, maximum: [5.3, 5.3, 5.3] as const };
import { sineCosineSurface as f, sineCosineGradient as getJacobian, sineCosineHessian as getHessian, sineCosineTaylor } from './legacyCalculusMath';

// ... (math functions skipped)

// ...

function CameraController({ autoRotate, reset }: { autoRotate: boolean, reset: number }) {
    const moving = useSceneMotion();
    const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

    useEffect(() => {
        if (reset > 0 && controlsRef.current) {
            controlsRef.current.reset();
        }
    }, [reset]);

    return <OrbitControls ref={controlsRef} makeDefault autoRotate={moving && autoRotate} autoRotateSpeed={2.0} enableDamping dampingFactor={0.05} />;
}

// --- Config ---
const CONF = {
    colorSurface: '#3b82f6',
    colorHessian: '#ef4444',
    colorJacobian: '#1e40af',
    axisLength: 5
};

// --- Components ---

function MainSurface() {
    const geometry = useMemo(() => {
        const size = 8;
        const res = 100;
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
                <meshPhongMaterial
                    color={CONF.colorSurface}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.7}
                    shininess={50}
                />
            </mesh>
            <mesh geometry={geometry}>
                <meshBasicMaterial color="#000000" wireframe transparent opacity={0.1} />
            </mesh>
        </group>
    );
}

function HessianSurface({ x, y, visible }: { x: number, y: number, visible: boolean }) {
    const geometry = useMemo(() => {
        const result = new THREE.PlaneGeometry(1.5, 1.5, 20, 20);
        const positions = result.attributes.position;
        for (let index = 0; index < positions.count; index++) {
            const dx = positions.getX(index); const dy = positions.getY(index);
            positions.setXYZ(index, dx, sineCosineTaylor(x, y, dx, dy) + 0.05, dy);
        }
        result.computeVertexNormals();
        return result;
    }, [x, y]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <mesh position={[x, 0, y]} geometry={geometry} visible={visible}>
        <meshPhongMaterial color={CONF.colorHessian} side={THREE.DoubleSide} transparent opacity={0.5} shininess={30} />
    </mesh>;
}

function JacobianVector({ x, y, visible }: { x: number, y: number, visible: boolean }) {
    if (!visible) return null;
    const [dx, dy] = getJacobian(x, y);
    return <Arrow direction={[dx, 0, dy]} origin={[x, f(x, y) + 0.05, y]} color={CONF.colorJacobian} />;
}

function Axes() {
    return (
        <group>
            {/* X Axis - Red */}
            <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(CONF.axisLength, 0, 0)]} color="#f87171" lineWidth={2} />
            <Html position={[CONF.axisLength + 0.2, 0, 0]} center zIndexRange={[40, 0]} pointerEvents="none"><div style={{ color: '#f87171', fontWeight: 'bold' }}>X</div></Html>

            {/* Y Axis - Green (Vertical in Three.js usually, but here Z corresponds to Y in user logic f(x,y)) */}
            {/* User said: Axes: X (Red), Y (Green), Z (Blue) */}
            {/* In R3F/Three: Y is Up. The function is z = f(x,y). This maps to Y = f(x,z) in R3F standard, OR z=f(x,y) if Z is up. */}
            {/* The user code: surface.rotation.x = -Math.PI / 2; -> This puts the plane in XZ. */}
            {/* Vertices: x, y -> z=f(x,y). This means Y is Up in 3D space, and (x,y) domain is on the XZ plane. */}
            {/* So coordinate 'y' maps to 3D Z-axis. */}

            <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, CONF.axisLength, 0)]} color="#60a5fa" lineWidth={2} />
            <Html position={[0, CONF.axisLength + 0.2, 0]} center zIndexRange={[40, 0]} pointerEvents="none"><div style={{ color: '#60a5fa', fontWeight: 'bold' }}>Z</div></Html>

            <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, CONF.axisLength)]} color="#34d399" lineWidth={2} />
            <Html position={[0, 0, CONF.axisLength + 0.2]} center zIndexRange={[40, 0]} pointerEvents="none"><div style={{ color: '#34d399', fontWeight: 'bold' }}>Y</div></Html>
        </group>
    );
}

function PointMarker({ x, y }: { x: number, y: number }) {
    const z = f(x, y);
    return (
        <mesh position={[x, z, y]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color="black" />
        </mesh>
    );
}

// CameraController moved to top


// --- Main Scene ---

export default function JacobianHessian() {
    const { topicId } = useParams();
    const moving = useSceneMotion();
    const [coords, setCoords] = useState({ x: 0.5, y: 0.5 });
    const [showJacobian, setShowJacobian] = useState(true);
    const [showHessian, setShowHessian] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false); // Default off to allow interaction
    const [resetCount, setResetCount] = useState(0);

    const [dfdx, dfdy] = getJacobian(coords.x, coords.y);
    const h = getHessian(coords.x, coords.y);

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '300px' }}>
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>Derivative Visualizer</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>f(x,y) = sin(x)cos(y)</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'white' }}>
                    <input type="checkbox" checked={showJacobian} onChange={e => setShowJacobian(e.target.checked)} />
                    <span style={{ color: CONF.colorJacobian, fontWeight: 'bold' }}>Show Jacobian (Gradient)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'white' }}>
                    <input type="checkbox" checked={showHessian} onChange={e => setShowHessian(e.target.checked)} />
                    <span style={{ color: CONF.colorHessian, fontWeight: 'bold' }}>Show Hessian (Curvature)</span>
                </label>
            </div>

            <div style={{ paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                    <span>X: {coords.x.toFixed(2)}</span>
                </div>
                <input aria-label="Coordinate X"
                    type="range" min="-3" max="3" step="0.1" value={coords.x}
                    onChange={e => setCoords(p => ({ ...p, x: parseFloat(e.target.value) }))}
                    style={{ width: '100%', accentColor: '#6366f1' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginTop: '8px', marginBottom: '4px' }}>
                    <span>Y: {coords.y.toFixed(2)}</span>
                </div>
                <input aria-label="Coordinate Y"
                    type="range" min="-3" max="3" step="0.1" value={coords.y}
                    onChange={e => setCoords(p => ({ ...p, y: parseFloat(e.target.value) }))}
                    style={{ width: '100%', accentColor: '#6366f1' }}
                />
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {/* Math Display */}
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'white' }}>
                    <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: CONF.colorJacobian }}>J</span> = [{dfdx.toFixed(2)}, {dfdy.toFixed(2)}]
                    </div>
                    <div>
                        <span style={{ fontWeight: 'bold', color: CONF.colorHessian }}>H</span> =
                        <div style={{ display: 'inline-grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', verticalAlign: 'top', marginLeft: '8px', borderLeft: '2px solid #fff', borderRight: '2px solid #fff', padding: '0 4px' }}>
                            <span>{h[0][0].toFixed(2)}</span><span>{h[0][1].toFixed(2)}</span>
                            <span>{h[1][0].toFixed(2)}</span><span>{h[1][1].toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => setAutoRotate(!autoRotate)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #334155', background: autoRotate ? '#6366f1' : '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><RotateCw size={14} />{autoRotate ? 'Stop' : 'Rotate'}</button>
                <button onClick={() => { setCoords({ x: 0.5, y: 0.5 }); setAutoRotate(false); setResetCount(count => count + 1); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><RefreshCcw size={14} />Reset</button>
            </div>

        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas frameloop={moving && autoRotate ? 'always' : 'demand'} dpr={[1, 1.5]} shadows camera={SURFACE_CAMERA} aria-label="3D visualization comparing Jacobian gradient and Hessian curvature on a surface">
                <FitSceneCamera bounds={SURFACE_BOUNDS} />
                <color attach="background" args={['#0b0f19']} />

                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 20, 10]} intensity={0.8} />
                <gridHelper args={[10, 20, 0x475569, 0x1e293b]} position={[0, -1.5, 0]} />

                <MainSurface />
                <Axes />
                <PointMarker x={coords.x} y={coords.y} />

                <JacobianVector x={coords.x} y={coords.y} visible={showJacobian} />
                <HessianSurface x={coords.x} y={coords.y} visible={showHessian} />

                <CameraController autoRotate={autoRotate} reset={resetCount} />
            </SceneCanvas>
            <SceneAxisKey axes={[{ label: 'X', meaning: 'input x', color: '#f87171' }, { label: 'Y', meaning: 'input y on the floor', color: '#34d399' }, { label: 'Z', meaning: 'vertical f(x, y)', color: '#60a5fa' }]} />
        </SceneContainer>
    );
}
