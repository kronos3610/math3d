import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useState } from 'react';

import { OrbitControls } from '@react-three/drei';
import { Arrow } from '../../components/3d/Arrow';
import { Label } from '../../components/3d/Label';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { useParams } from 'react-router-dom';

/* Simplified data */
const DATA = {
    x: [3, 3, 3] as [number, number, number],
    x_row: [1, 4, 2] as [number, number, number],
    x_null: [2, -1, 1] as [number, number, number],
};

type ViewMode = 'domain' | 'codomain';

/* Domain view - simplified */
function DomainView() {
    return (
        <group>
            {/* Input vector x */}
            <Arrow direction={DATA.x} color="#eab308" lineWidth={3} />
            <Label text="x=[3,3,3]" position={[3.5, 3.5, 3]} color="#facc15" />

            {/* Row space component */}
            <Arrow direction={DATA.x_row} color="#86efac" lineWidth={3} />
            <Label text="x_r=[1,4,2]" position={[1, 5, 2]} color="#86efac" />

            {/* Null space component */}
            <Arrow direction={DATA.x_null} color="#fca5a5" lineWidth={3} />
            <Label text="x_n=[2,-1,1]" position={[3, -1.5, 1]} color="#fca5a5" />
        </group>
    );
}

/* Scene base */
function SceneBase() {
    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 10]} intensity={0.5} />
            <axesHelper args={[5]} />
        </>
    );
}

/* Main component */
export default function FundamentalSpacesOptimized() {
    const { topicId } = useParams();
    const [mode, setMode] = useState<ViewMode>('domain');

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white', margin: 0 }}>Fundamental Subspaces</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
                    Lite Version (Reduced GPU Load)
                </p>
            </div>

            <GlassPane style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155', borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono', color: '#e2e8f0', margin: 0, lineHeight: 1.8 }}>
                    <span style={{ color: '#facc15' }}>x</span> = [3,3,3]<br />
                    <span style={{ color: '#86efac' }}>x_r</span> = [1,4,2] (row space)<br />
                    <span style={{ color: '#fca5a5' }}>x_n</span> = [2,-1,1] (null space)
                </p>
            </GlassPane>

            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => setMode('domain')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: mode === 'domain' ? '#4f46e5' : '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                    Domain (ℝ³)
                </button>
            </div>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId}`} controls={controls}>
            <SceneCanvas frameloop="demand"
                camera={{ position: [8, 8, 8], fov: 50 }}
                dpr={[1, 1.5]}
                gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
                aria-label="Fundamental Subspaces Lite"
            >
                <SceneBase />
                <DomainView />
                <OrbitControls />
                <fog attach="fog" args={['#0b0f19', 10, 30]} />
                <color attach="background" args={['#0b0f19']} />
            </SceneCanvas>
        </SceneContainer>
    );
}
