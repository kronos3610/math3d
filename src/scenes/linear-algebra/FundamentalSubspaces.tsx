import { VIZ } from '../../data/palette';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState } from 'react';
import { OrbitControls, Line } from '@react-three/drei';
import { Arrow } from '../../components/3d/Arrow';
import { Label } from '../../components/3d/Label';
import { SubspacePlane, SubspaceLine } from '../../components/3d/Subspace';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';

/* ========== Data ========== */
import { SUBSPACE_EXAMPLE as DATA } from './legacyLinearMath';

type ViewMode = 'domain' | 'codomain';

/* ========== Domain Scene ========== */
function DomainView() {
    return (
        <group>
            <SubspacePlane normal={DATA.rowNormal} color={VIZ.truth} />
            <Label text="Row Space C(Aᵀ)" position={[4, 6, 0]} color={VIZ.truth} />

            <SubspaceLine direction={DATA.rowNormal} color={VIZ.error} />
            <Label text="Null Space N(A)" position={[4, -3, 3]} color={VIZ.error} />

            <Arrow direction={DATA.x} color={VIZ.focus} thickness={0.12} />
            <Label text="x = [3,3,3]" position={[3.5, 3.5, 3]} color={VIZ.focus} />

            <Arrow direction={DATA.x_row} color={VIZ.truth} thickness={0.06} />
            <Label text="x_r = [1,4,2]" position={[1, 5, 2]} color={VIZ.truth} />

            <Arrow direction={DATA.x_null} color={VIZ.error} thickness={0.06} />
            <Label text="x_n = [2,-1,1]" position={[3, -1.5, 1]} color={VIZ.error} />

            <Arrow direction={DATA.x_null} color="#64748b" origin={DATA.x_row} thickness={0.03} />
            <Label text="⊥" position={[1.5, 0.5, 1.5]} color={VIZ.axis} />
        </group>
    );
}

/* ========== Codomain Scene ========== */
function CodomainView() {
    return (
        <group>
            <SubspacePlane normal={DATA.colNormal} color={VIZ.data} />
            <Label text="Column Space C(A)" position={[6, -4, 4]} color={VIZ.data} />

            <SubspaceLine direction={DATA.colNormal} color={VIZ.focus} />
            <Label text="Left Null Space N(Aᵀ)" position={[-4, -5, 5]} color={VIZ.focus} />

            <Arrow direction={DATA.c1} color={VIZ.data} thickness={0.06} />
            <Label text="c₁ = [1,0,1]" position={[1, 1, 1]} color={VIZ.data} />

            <Arrow direction={DATA.c2} color={VIZ.data} thickness={0.06} />
            <Label text="c₂ = [2,1,3]" position={[2, 2, 3]} color={VIZ.data} />

            <Arrow direction={DATA.b} color={VIZ.output} thickness={0.15} />
            <Label text="b = Ax = [9,6,15]" position={[10, 7, 16]} color={VIZ.output} />
            <Label text="b = −3c₁ + 6c₂" position={[5, -1, 8]} color={VIZ.output} />
        </group>
    );
}

/* ========== Shared Scene Elements ========== */
function SceneBase() {
    return (
        <>
            <ambientLight intensity={0.7} />
            <directionalLight position={[15, 25, 15]} intensity={0.5} />
            <group>{[0,1,2].map(axis => {
                const end: [number,number,number] = [0,0,0]; end[axis] = 12;
                return <group key={axis}><Line points={[[0,0,0],end]} color={VIZ.axis} transparent opacity={0.4} />
                    <Label text={['x','y','z'][axis]} position={end} color={VIZ.axis} fontSize={0.35} /></group>;
            })}</group>
            <gridHelper args={[30, 30, '#334155', '#0a0a0f']} position={[0, -0.01, 0]} />
            <fog attach="fog" args={['#050508', 20, 60]} />
        </>
    );
}

// --- Main Component ---

export default function FundamentalSubspaces() {
    const { topicId } = useParams();
    const [mode, setMode] = useState<ViewMode>('domain');

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white', margin: 0 }}>Fundamental Subspaces</h3>
                <p style={{ fontSize: '12px', color: VIZ.axis, lineHeight: 1.6 }}>
                    Every m×n matrix A defines 4 fundamental subspaces that come in two orthogonal pairs.
                </p>
            </div>

            {/* Matrix Display */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontFamily: '"JetBrains Mono", monospace', fontSize: '12px'
            }}>
                {/* Simplified Matrix A */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: 4 }}>A</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 6px', borderLeft: '2px solid #64748b', borderRight: '2px solid #64748b', padding: '0 6px', color: 'white' }}>
                        <span>1</span><span>2</span><span>0</span>
                        <span>0</span><span>1</span><span>1</span>
                        <span>1</span><span>3</span><span>1</span>
                    </div>
                </div>
                <span style={{ color: '#64748b' }}>·</span>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: 4 }}>x</div>
                    <span style={{ color: '#facc15' }}>[3,3,3]</span>
                </div>
                <span style={{ color: '#64748b' }}>=</span>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: 4 }}>b</div>
                    <span style={{ color: '#e879f9' }}>[9,6,15]</span>
                </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    aria-pressed={mode === 'domain'} onClick={() => setMode('domain')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: mode === 'domain' ? '#4f46e5' : VIZ.grid, color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                    Domain (ℝ³)
                </button>
                <button
                    aria-pressed={mode === 'codomain'} onClick={() => setMode('codomain')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: mode === 'codomain' ? '#c026d3' : VIZ.grid, color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                    Codomain (ℝ³)
                </button>
            </div>

            {/* Key Insight */}
            <GlassPane style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '14px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: VIZ.variation, marginBottom: '6px' }}>Key Insight</h4>
                <ul style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6, paddingLeft: '16px', margin: 0 }}>
                    <li><strong style={{ color: '#34d399' }}>Row Space</strong>: 2D Plane</li>
                    <li><strong style={{ color: '#f87171' }}>Null Space</strong>: 1D Line</li>
                    <li><strong style={{ color: VIZ.data }}>Col Space</strong>: 2D Plane</li>
                    <li><strong style={{ color: '#fb923c' }}>Left Null</strong>: 1D Line</li>
                </ul>
            </GlassPane>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls} legend={mode === 'domain' ? [{ label: 'x', meaning: 'given input', color: VIZ.focus, shape: 'line' }, { label: 'Row space', meaning: 'orthogonal component preserved by A', color: VIZ.truth, shape: 'square' }, { label: 'Null space', meaning: 'component annihilated by A', color: VIZ.error, shape: 'line' }] : [{ label: 'Column space', meaning: 'possible outputs', color: VIZ.data, shape: 'square' }, { label: 'Left null', meaning: 'orthogonal output complement', color: VIZ.focus, shape: 'line' }, { label: 'Ax', meaning: 'transformed output', color: VIZ.output, shape: 'line' }]}>
            <SceneCanvas frameloop="demand"
                camera={{ position: [20, 14, 20], fov: 45 }}
                style={{ width: '100%', height: '100%' }}
                dpr={[1, 1.5]}
                aria-label="3D visualization of the four fundamental subspaces of a matrix"
            >
                <SceneBase />
                {mode === 'domain' ? <DomainView /> : <CodomainView />}
                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
            </SceneCanvas>
        </SceneContainer>
    );
}
