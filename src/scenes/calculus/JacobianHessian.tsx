import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useMemo, useRef, useEffect, type ComponentRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCw, RefreshCcw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';

// ... (math functions skipped)

// ...

function CameraController({ autoRotate, reset }: { autoRotate: boolean, reset: number }) {
    const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

    useEffect(() => {
        if (reset > 0 && controlsRef.current) {
            controlsRef.current.reset();
        }
    }, [reset]);

    useFrame(() => {
        if (autoRotate && controlsRef.current) {
            controlsRef.current.update();
        }
    });

    return <OrbitControls ref={controlsRef} makeDefault autoRotate={autoRotate} autoRotateSpeed={2.0} enableDamping dampingFactor={0.05} />;
}

// --- Mathematical Functions ---
const f = (x: number, y: number) => Math.sin(x) * Math.cos(y);

const getJacobian = (x: number, y: number) => {
    return [Math.cos(x) * Math.cos(y), -Math.sin(x) * Math.sin(y)];
};

const getHessian = (x: number, y: number) => {
    const h11 = -Math.sin(x) * Math.cos(y);
    const h12 = -Math.cos(x) * Math.sin(y);
    const h22 = -Math.sin(x) * Math.cos(y);
    return [[h11, h12], [h12, h22]];
};

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
    const meshRef = useRef<THREE.Mesh>(null);
    const z = f(x, y);
    const [dfdx, dfdy] = getJacobian(x, y);
    const h = getHessian(x, y);

    useFrame(() => {
        if (meshRef.current && visible) {
            const geo = meshRef.current.geometry;
            const pos = geo.attributes.position;

            // The plane geometry is created at (0,0,0). We need to transform local coordinates to world
            // However, the mesh itself acts as a local coordinate system centered at (x,0,y) if we move it there.
            // But here we'll compute vertex positions relative to the center point (0,0) of the plane

            for (let i = 0; i < pos.count; i++) {
                // Local coordinates typically range from -0.75 to 0.75 for a 1.5 size plane
                // We need to fetch the original X/Y from the geometry.
                // Since we are modifying position directly, we should be careful. 
                // Better approach: Re-compute z based on dx, dy offset from center.

                // Let's assume the plane is standard PlaneGeometry in XY plane (before rotation).
                // Actually, logic is easier if we compute world positions.

                // Let's reconstruct based on a fresh geometry or attributes each frame? No, expensive.
                // We'll trust the initial x/y coordinates of the plane geometry as local offsets (dx, dy).

                // WAIT: The user code iterates over vertices of hGeo.
                // let dx = hPos[i]; let dy = hPos[i+1];
                // linearPart = dfdx * dx + dfdy * dy;
                // quadraticPart = ...
                // hPos[i+2] = z + linearPart + quadraticPart + 0.01;

                const dx_local = pos.getX(i);
                const dy_local = pos.getY(i);

                const linearPart = dfdx * dx_local + dfdy * dy_local;
                const quadraticPart = 0.5 * (h[0][0] * dx_local * dx_local + 2 * h[0][1] * dx_local * dy_local + h[1][1] * dy_local * dy_local);

                // We want the surface to be positioned at (x, z, y).
                // But passing z in the vertex shader or here?
                // The mesh is positioned at [x, 0, y] in the user code, and z is calculated absolutely.
                // Let's follow user: mesh at (x, 0, y), vertices set to z_global.

                // Actually, easier: Mesh at (x, 0, y). 
                // Local Vertex Z = z_center + linear + quadratic.
                // Wait, if mesh is at (x,0,y), then local y (which becomes world z after rotation) is vertical.
                // User code: rotation.x = -Math.PI/2. So local (x, y, z) -> world (x, z, -y)? No.
                // PlaneGeometry is in XY. Rotated -90deg X -> plane is in XZ.
                // Local X -> World X. Local Y -> World -Z. Local Z -> World Y.
                // Let's stick to standard R3F: PlaneGeometry is usually used for floors.
                // Let's compute z offset.

                const z_val = z + linearPart + quadraticPart + 0.05; // +0.05 to prevent Z-fight
                pos.setZ(i, z_val);
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
        }
    });

    return (
        <group position={[x, 0, y]} rotation={[-Math.PI / 2, 0, 0]} visible={visible}>
            {/* Use a fresh geometry each mount? Or static? Static is fine if we update it. */}
            <mesh ref={meshRef}>
                <planeGeometry args={[1.5, 1.5, 20, 20]} />
                <meshPhongMaterial
                    color={CONF.colorHessian}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.5}
                    shininess={30}
                />
            </mesh>
        </group>
    );
}

function JacobianVector({ x, y, visible }: { x: number, y: number, visible: boolean }) {
    if (!visible) return null;

    const z = f(x, y);
    const [dfdx, dfdy] = getJacobian(x, y);
    const dir = new THREE.Vector3(dfdx, 0, dfdy).normalize();
    const len = Math.sqrt(dfdx * dfdx + dfdy * dfdy);
    const origin = new THREE.Vector3(x, z + 0.05, y); // Lift slightly

    if (len < 0.01) return null;

    return (
        <group position={origin} rotation={new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))}>
            {/* Arrow Shaft */}
            <mesh position={[0, (len * 0.8 + 0.2) / 2, 0]}>
                <cylinderGeometry args={[0.05, 0.05, len * 0.8 + 0.2, 8]} />
                <meshBasicMaterial color={CONF.colorJacobian} toneMapped={false} />
            </mesh>
            {/* Arrow Head */}
            <mesh position={[0, len * 0.8 + 0.2, 0]}>
                <coneGeometry args={[0.15, 0.4, 16]} />
                <meshBasicMaterial color={CONF.colorJacobian} toneMapped={false} />
            </mesh>
        </group>
    );
}

function Axes() {
    return (
        <group>
            {/* X Axis - Red */}
            <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(CONF.axisLength, 0, 0)]} color="red" lineWidth={2} />
            <Html position={[CONF.axisLength + 0.2, 0, 0]}><div style={{ color: 'red', fontWeight: 'bold' }}>X</div></Html>

            {/* Y Axis - Green (Vertical in Three.js usually, but here Z corresponds to Y in user logic f(x,y)) */}
            {/* User said: Axes: X (Red), Y (Green), Z (Blue) */}
            {/* In R3F/Three: Y is Up. The function is z = f(x,y). This maps to Y = f(x,z) in R3F standard, OR z=f(x,y) if Z is up. */}
            {/* The user code: surface.rotation.x = -Math.PI / 2; -> This puts the plane in XZ. */}
            {/* Vertices: x, y -> z=f(x,y). This means Y is Up in 3D space, and (x,y) domain is on the XZ plane. */}
            {/* So coordinate 'y' maps to 3D Z-axis. */}

            <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, CONF.axisLength, 0)]} color="blue" lineWidth={2} />
            <Html position={[0, CONF.axisLength + 0.2, 0]}><div style={{ color: 'blue', fontWeight: 'bold' }}>Z</div></Html>

            <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, CONF.axisLength)]} color="green" lineWidth={2} />
            <Html position={[0, 0, CONF.axisLength + 0.2]}><div style={{ color: 'green', fontWeight: 'bold' }}>Y</div></Html>
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
    const [coords, setCoords] = useState({ x: 0.5, y: 0.5 });
    const [showJacobian, setShowJacobian] = useState(true);
    const [showHessian, setShowHessian] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false); // Default off to allow interaction
    const [resetCount] = useState(0);

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
                <input
                    type="range" min="-3" max="3" step="0.1" value={coords.x}
                    onChange={e => setCoords(p => ({ ...p, x: parseFloat(e.target.value) }))}
                    style={{ width: '100%', accentColor: '#6366f1' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginTop: '8px', marginBottom: '4px' }}>
                    <span>Y: {coords.y.toFixed(2)}</span>
                </div>
                <input
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
                <button onClick={() => { setCoords({ x: 0.5, y: 0.5 }); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><RefreshCcw size={14} />Reset</button>
            </div>

        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas dpr={[1, 1.5]} shadows camera={{ position: [5, 5, 5], fov: 75 }} aria-label="3D visualization comparing Jacobian gradient and Hessian curvature on a surface">
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
        </SceneContainer>
    );
}
