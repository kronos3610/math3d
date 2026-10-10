import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';

import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import Latex from '../../components/Latex';

// --- Constants ---

const Z_SCALE = 0.15;

// --- Bowl surface (static, built once) ---

function BowlSurface() {
    const [geo] = useState(() => {
        const g = new THREE.PlaneGeometry(10, 10, 50, 50);
        const pos = g.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
            // PlaneGeometry is in XY; remap to XZ (three.js Y-up) with bowl height on Y
            const mx = pos.getX(i) + 2;
            const my = pos.getY(i) + 2;
            pos.setXYZ(i, mx, (mx * mx + my * my) * Z_SCALE, my);
        }
        g.computeVertexNormals();
        return g;
    });

    return (
        <>
            <mesh geometry={geo}>
                <meshPhongMaterial
                    color="#94a3b8"
                    side={THREE.DoubleSide}
                    transparent opacity={0.35}
                    shininess={40}
                />
            </mesh>
            <mesh geometry={geo}>
                <meshBasicMaterial color="#475569" wireframe transparent opacity={0.12} />
            </mesh>
        </>
    );
}

// --- Constraint path (static, built once) ---

function ConstraintPath() {
    const [line] = useState(() => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 120; i++) {
            const tExt = -0.25 + 1.5 * (i / 120);
            const xx = 4 * tExt;
            const yy = 4 * (1 - tExt);
            pts.push(new THREE.Vector3(xx, (xx * xx + yy * yy) * Z_SCALE + 0.06, yy));
        }
        return new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: '#3b82f6' }),
        );
    });
    useEffect(() => () => {
        line.geometry.dispose();
        line.material.dispose();
    }, [line]);
    return <primitive object={line} />;
}

// --- Moving point + gradient arrows (updated imperatively) ---

function MovingPoint({ t, showGradients }: { t: number; showGradients: boolean }) {
    const cX = 4 * t;
    const cY = 4 * (1 - t);
    const cZ = (cX * cX + cY * cY) * Z_SCALE;
    const isOptimal = Math.abs(t - 0.5) < 0.02;

    const dropLineRef = useRef<THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>>(null);
    const arrowFRef = useRef<THREE.ArrowHelper>(null);
    const arrowGRef = useRef<THREE.ArrowHelper>(null);

    // Drop dashed line
    const dropLine = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3(),
        ]);
        const mat = new THREE.LineDashedMaterial({ color: '#475569', dashSize: 0.18, gapSize: 0.18 });
        const ln = new THREE.Line(geo, mat);
        return ln;
    }, []);

    // Gradient arrows (created once, updated imperatively)
    const arrowF = useMemo(() =>
        new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xef4444, 0.5, 0.3), []
    );
    const arrowG = useMemo(() =>
        new THREE.ArrowHelper(new THREE.Vector3(1, 0, 1).normalize(), new THREE.Vector3(), 2.1, 0x2563eb, 0.5, 0.3), []
    );

    useEffect(() => () => {
        dropLine.geometry.dispose();
        dropLine.material.dispose();
        arrowF.dispose();
        arrowG.dispose();
    }, [dropLine, arrowF, arrowG]);

    // Update drop line, arrows imperatively whenever t changes
    useEffect(() => {
        const dropLine = dropLineRef.current;
        const arrowF = arrowFRef.current;
        const arrowG = arrowGRef.current;
        if (!dropLine || !arrowF || !arrowG) return;
        // Drop line
        const positions = dropLine.geometry.attributes.position as THREE.BufferAttribute;
        if (!positions) {
            const pts = [new THREE.Vector3(cX, cZ + 0.06, cY), new THREE.Vector3(cX, 0, cY)];
            dropLine.geometry.setFromPoints(pts);
        } else {
            positions.setXYZ(0, cX, cZ + 0.06, cY);
            positions.setXYZ(1, cX, 0, cY);
            positions.needsUpdate = true;
        }
        dropLine.computeLineDistances();

        // ∇f = [2x, 2y], in floor plane (three.js XZ)
        const gradFx = 2 * cX;
        const gradFy = 2 * cY;
        const lenF = Math.hypot(gradFx, gradFy);
        const scaleF = Math.max(0.4, lenF * 0.25);
        const dirFx = lenF > 0 ? gradFx / lenF : 1;
        const dirFy = lenF > 0 ? gradFy / lenF : 0;

        arrowF.position.set(cX, 0.02, cY);
        arrowF.setDirection(new THREE.Vector3(dirFx, 0, dirFy).normalize());
        arrowF.setLength(scaleF, Math.min(0.55, scaleF * 0.35), 0.28);
        arrowF.visible = showGradients;

        // ∇g = [1, 1] (normalized)
        arrowG.position.set(cX, 0.02, cY);
        arrowG.setDirection(new THREE.Vector3(1, 0, 1).normalize());
        arrowG.setLength(2.1, 0.55, 0.28);
        arrowG.visible = showGradients;
    }, [t, cX, cY, cZ, showGradients, dropLine, arrowF, arrowG]);

    // Compute label positions for render
    const gradFx = 2 * cX;
    const gradFy = 2 * cY;
    const lenF = Math.hypot(gradFx, gradFy);
    const scaleF = Math.max(0.4, lenF * 0.25);
    const dirFx = lenF > 0 ? gradFx / lenF : 1;
    const dirFy = lenF > 0 ? gradFy / lenF : 0;
    const scaleG = 2.1;

    return (
        <>
            <primitive ref={dropLineRef} object={dropLine} />
            <primitive ref={arrowFRef} object={arrowF} />
            <primitive ref={arrowGRef} object={arrowG} />

            {/* Floor shadow dot */}
            <mesh position={[cX, 0.01, cY]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.45, 0.45]} />
                <meshBasicMaterial color="#475569" transparent opacity={0.55} />
            </mesh>

            {/* Main point on path */}
            <mesh position={[cX, cZ + 0.06, cY]}>
                <sphereGeometry args={[0.28, 32, 32]} />
                <meshPhongMaterial
                    color={isOptimal ? '#10b981' : '#e2e8f0'}
                    emissive={isOptimal ? '#065f46' : '#1e293b'}
                    shininess={80}
                />
            </mesh>

            {/* Optimal glow ring */}
            {isOptimal && (
                <mesh position={[cX, cZ + 0.06, cY]}>
                    <sphereGeometry args={[0.46, 32, 32]} />
                    <meshBasicMaterial color="#10b981" wireframe transparent opacity={0.45} />
                </mesh>
            )}

            {/* Gradient labels — always rendered; HTML visibility matches arrows */}
            {showGradients && (
                <>
                    <Html position={[cX + dirFx * scaleF * 1.5, 0.65, cY + dirFy * scaleF * 1.5]} center>
                        <span style={{
                            color: '#f87171', fontSize: '15px', fontWeight: 800,
                            textShadow: '0 0 6px #000', pointerEvents: 'none',
                        }}>∇f</span>
                    </Html>
                    <Html position={[cX + (1 / Math.SQRT2) * scaleG * 1.5, 0.65, cY + (1 / Math.SQRT2) * scaleG * 1.5]} center>
                        <span style={{
                            color: '#60a5fa', fontSize: '15px', fontWeight: 800,
                            textShadow: '0 0 6px #000', pointerEvents: 'none',
                        }}>∇g</span>
                    </Html>
                </>
            )}
        </>
    );
}

// --- Full scene ---

function Scene3D({ t, showGradients }: { t: number; showGradients: boolean }) {
    return (
        <>
            <color attach="background" args={['#0b0f19']} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={0.6} />

            <OrbitControls
                target={[2, 1.5, 2]}
                enablePan={false}
                maxPolarAngle={Math.PI / 2.08}
                minDistance={8}
                maxDistance={30}
            />

            <gridHelper args={[10, 10, 0x334155, 0x1e293b]} position={[2, 0, 2]} />

            {/* Axis labels */}
            <Html position={[7.8, 0.35, 2]} center>
                <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700, textShadow: '0 0 5px #000', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    X Axis
                </span>
            </Html>
            <Html position={[2, 0.35, 7.8]} center>
                <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 700, textShadow: '0 0 5px #000', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    Y Axis
                </span>
            </Html>

            {/* Bowl label */}
            <Html position={[-1.5, 4.2, -1.5]} center>
                <div style={{
                    color: '#94a3b8', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(11,15,25,0.85)', padding: '3px 10px',
                    borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'nowrap',
                    border: '1px solid rgba(148,163,184,0.15)',
                }}>
                    f(x,y) = x² + y²
                </div>
            </Html>

            {/* Path label */}
            <Html position={[0.5, 3.2, 3.5]} center>
                <div style={{
                    color: '#60a5fa', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(11,15,25,0.85)', padding: '3px 10px',
                    borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'nowrap',
                    border: '1px solid rgba(59,130,246,0.2)',
                }}>
                    x + y = 4
                </div>
            </Html>

            <BowlSurface />
            <ConstraintPath />
            <MovingPoint t={t} showGradients={showGradients} />
        </>
    );
}

// --- Main export ---

export default function LagrangeMultipliers() {
    const { topicId } = useParams();
    const [t, setT] = useState(0.2);
    const [showGradients, setShowGradients] = useState(true);

    const cX = 4 * t;
    const cY = 4 * (1 - t);
    const fVal = (cX * cX + cY * cY).toFixed(2);
    const lambda = (2 * cX).toFixed(2);   // λ = ∇f₁ / ∇g₁ = 2x / 1
    const isOptimal = Math.abs(t - 0.5) < 0.02;

    const controls = (
        <GlassPane style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                    Lagrange Multipliers
                </h2>
                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Drag scene to orbit · slider to move along path
                </p>
            </div>

            {/* Problem formula */}
            <div style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '12px',
                textAlign: 'center',
            }}>
                <Latex formula="\min\; f(x,y) = x^2 + y^2" display />
                <div style={{ color: '#475569', fontSize: '11px', margin: '4px 0' }}>subject to</div>
                <Latex formula="g(x,y) = x + y - 4 = 0" display />
            </div>

            {/* Path slider */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Position on Path
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                        t = {t.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range" min="0" max="1" step="0.01" value={t}
                    onChange={e => setT(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', marginTop: '3px' }}>
                    <span>← backward</span>
                    <span style={{ color: isOptimal ? '#10b981' : '#475569', fontWeight: isOptimal ? 700 : 400 }}>
                        OPTIMAL (t = 0.5)
                    </span>
                    <span>forward →</span>
                </div>
            </div>

            {/* Live values */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                padding: '12px',
            }}>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    Live Values
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                        { label: 'x', value: cX.toFixed(2), color: '#f87171' },
                        { label: 'y', value: cY.toFixed(2), color: '#4ade80' },
                        { label: 'f (x,y)', value: fVal, color: isOptimal ? '#10b981' : '#60a5fa' },
                        { label: 'λ  =  ∇f / ∇g', value: lambda, color: isOptimal ? '#10b981' : '#a78bfa' },
                    ].map(({ label, value, color }) => (
                        <div key={label}>
                            <div style={{ color: '#475569', fontSize: '10px', marginBottom: '2px' }}>{label}</div>
                            <div style={{ color, fontFamily: 'monospace', fontWeight: 700, fontSize: '15px' }}>{value}</div>
                        </div>
                    ))}
                </div>
                {isOptimal && (
                    <div style={{
                        marginTop: '10px', padding: '6px 10px',
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '8px', fontSize: '11px',
                        color: '#34d399', textAlign: 'center', fontWeight: 700,
                    }}>
                        ✓ Optimal — ∇f = λ∇g holds here
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <button
                onClick={() => setT(0.5)}
                style={{
                    padding: '10px', borderRadius: '8px',
                    border: '1px solid rgba(16,185,129,0.4)',
                    background: 'rgba(16,185,129,0.15)',
                    color: '#34d399', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    transition: 'all 0.2s',
                }}
            >
                Snap to Optimal Solution
            </button>
            <button
                onClick={() => setShowGradients(g => !g)}
                style={{
                    padding: '8px 12px', borderRadius: '8px',
                    border: `1px solid ${showGradients ? '#334155' : 'rgba(99,102,241,0.4)'}`,
                    background: showGradients ? '#1e293b' : 'rgba(99,102,241,0.15)',
                    color: showGradients ? '#94a3b8' : '#a78bfa',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    transition: 'all 0.2s',
                }}
            >
                {showGradients ? 'Hide' : 'Show'} Floor Gradients
            </button>

            {/* What you're seeing */}
            <div style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '10px', padding: '12px',
                fontSize: '11px', color: '#a5b4fc', lineHeight: 1.75,
            }}>
                <b style={{ color: '#818cf8', display: 'block', marginBottom: '6px' }}>What you're seeing:</b>
                <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><span style={{ color: '#94a3b8' }}>Grey bowl</span> — objective f(x,y) = x² + y²</li>
                    <li><span style={{ color: '#60a5fa' }}>Blue path</span> — constraint curve x + y = 4</li>
                    <li><span style={{ color: '#f87171' }}>Red ∇f</span> — steepest ascent of f on the floor</li>
                    <li><span style={{ color: '#60a5fa' }}>Blue ∇g</span> — normal to the constraint line</li>
                    <li><span style={{ color: '#94a3b8' }}>Dashed drop</span> — height above the floor</li>
                </ul>
            </div>

            {/* Aha moment */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid #1e293b',
                borderRadius: '10px', padding: '12px',
                fontSize: '11px', color: '#94a3b8', lineHeight: 1.75,
            }}>
                <b style={{ color: 'white', display: 'block', marginBottom: '6px' }}>The Aha Moment:</b>
                Move the slider. The red and blue arrows point in different directions as you travel along the path.
                <br /><br />
                At the <span style={{ color: '#10b981', fontWeight: 700 }}>minimum (f = 8.00)</span> the two arrows align perfectly — one is just a scaled copy (λ) of the other:
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <Latex formula="\nabla f = \lambda\, \nabla g" display />
                </div>
            </div>

            <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', fontStyle: 'italic' }}>
                Drag to orbit · scroll to zoom
            </p>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'ml'}`} controls={controls}>
            <SceneCanvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [14, 10, 14], fov: 45 }} aria-label="Constrained optimization on a bowl with gradient arrows">
                <Scene3D t={t} showGradients={showGradients} />
            </SceneCanvas>
        </SceneContainer>
    );
}
