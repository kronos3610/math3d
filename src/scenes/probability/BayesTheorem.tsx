import { Label } from '../../components/3d/Label';
import { SceneCanvas } from '../../components/3d/SceneCanvas';
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { SceneContainer } from '../../components/layout/SceneContainer';
import { GlassPane } from '../../components/layout/GlassPane';
import { RefreshCcw } from 'lucide-react';

function BayesBlocks({ prior, likelihood, evidence }: { prior: number; likelihood: number; evidence: number }) {
    const groupRef = useRef<THREE.Group>(null!);

    useFrame((state) => {
        groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.3;
    });

    const posterior = evidence > 0 ? (likelihood * prior) / evidence : 0;

    return (
        <group ref={groupRef}>
            {/* Prior P(A) */}
            <RoundedBox args={[1.2, prior * 3, 1.2]} position={[-2.5, (prior * 3) / 2, 0]} radius={0.05}>
                <meshStandardMaterial color="#fd79a8" roughness={0.3} metalness={0.6} transparent opacity={0.8} />
            </RoundedBox>
            <Label position={[-2.5, prior * 3 + 0.4, 0]} fontSize={0.65} color="#fd79a8" text={`P(A) = ${prior.toFixed(2)}`} />
            <Label position={[-2.5, -0.4, 0]} fontSize={0.6} color="#888" text={`Prior`} />

            {/* Likelihood P(B|A) */}
            <RoundedBox args={[1.2, likelihood * 3, 1.2]} position={[-0.5, (likelihood * 3) / 2, 0]} radius={0.05}>
                <meshStandardMaterial color="#6c5ce7" roughness={0.3} metalness={0.6} transparent opacity={0.8} />
            </RoundedBox>
            <Label position={[-0.5, likelihood * 3 + 0.4, 0]} fontSize={0.65} color="#6c5ce7" text={`P(B|A) = ${likelihood.toFixed(2)}`} />
            <Label position={[-0.5, -0.4, 0]} fontSize={0.6} color="#888" text={`Likelihood`} />

            {/* Evidence P(B) */}
            <RoundedBox args={[1.2, evidence * 3, 1.2]} position={[1.5, (evidence * 3) / 2, 0]} radius={0.05}>
                <meshStandardMaterial color="#00cec9" roughness={0.3} metalness={0.6} transparent opacity={0.8} />
            </RoundedBox>
            <Label position={[1.5, evidence * 3 + 0.4, 0]} fontSize={0.65} color="#00cec9" text={`P(B) = ${evidence.toFixed(2)}`} />
            <Label position={[1.5, -0.4, 0]} fontSize={0.6} color="#888" text={`Evidence`} />

            {/* Posterior P(A|B) */}
            <RoundedBox args={[1.2, posterior * 3, 1.2]} position={[3.5, (posterior * 3) / 2, 0]} radius={0.05}>
                <meshStandardMaterial color="#fdcb6e" roughness={0.3} metalness={0.6} transparent opacity={0.8} />
            </RoundedBox>
            <Label position={[3.5, posterior * 3 + 0.4, 0]} fontSize={0.65} color="#fdcb6e" text={`P(A|B) = ${posterior.toFixed(2)}`} />
            <Label position={[3.5, -0.4, 0]} fontSize={0.6} color="#888" text={`Posterior`} />

            <gridHelper args={[10, 20, '#222', '#181828']} position={[0.5, -0.01, 0]} />
        </group>
    );
}

export default function BayesTheorem() {
    const { topicId } = useParams<{ topicId: string }>();
    const [prior, setPrior] = useState(0.3);
    const [likelihood, setLikelihood] = useState(0.8);
    const [evidence, setEvidence] = useState(0.5);

    const posterior = evidence > 0 ? (likelihood * prior) / evidence : 0;

    const reset = () => {
        setPrior(0.3);
        setLikelihood(0.8);
        setEvidence(0.5);
    };

    const controls = (
        <GlassPane className="scene-controls" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'white', margin: 0 }}>Bayes' Theorem</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', margin: '4px 0 0 0' }}>P(A|B) = P(B|A) × P(A) / P(B)</p>
            </div>

            {/* Prior slider */}
            <div>
                <div style={{ color: '#fd79a8', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Prior P(A)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="range" min="0.01" max="1" step="0.01" value={prior}
                        onChange={(e) => setPrior(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#fd79a8', height: '4px' }} />
                    <span style={{ fontSize: '11px', color: '#cbd5e1', width: '35px', textAlign: 'right' }}>{prior.toFixed(2)}</span>
                </div>
            </div>

            {/* Likelihood slider */}
            <div>
                <div style={{ color: '#6c5ce7', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Likelihood P(B|A)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="range" min="0.01" max="1" step="0.01" value={likelihood}
                        onChange={(e) => setLikelihood(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#6c5ce7', height: '4px' }} />
                    <span style={{ fontSize: '11px', color: '#cbd5e1', width: '35px', textAlign: 'right' }}>{likelihood.toFixed(2)}</span>
                </div>
            </div>

            {/* Evidence slider */}
            <div>
                <div style={{ color: '#00cec9', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Evidence P(B)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="range" min="0.01" max="1" step="0.01" value={evidence}
                        onChange={(e) => setEvidence(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#00cec9', height: '4px' }} />
                    <span style={{ fontSize: '11px', color: '#cbd5e1', width: '35px', textAlign: 'right' }}>{evidence.toFixed(2)}</span>
                </div>
            </div>

            {/* Posterior readout */}
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(253, 203, 110, 0.1)', border: '1px solid rgba(253, 203, 110, 0.2)' }}>
                <div style={{ color: '#fdcb6e', fontWeight: 700, fontSize: '14px' }}>
                    Posterior P(A|B) = {posterior.toFixed(3)}
                </div>
                {posterior > 1 && (
                    <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                        ⚠ P(B) must be ≥ P(B|A)×P(A) for valid probabilities
                    </div>
                )}
            </div>

            <button onClick={reset} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <RefreshCcw size={14} /> Reset Values
            </button>
        </GlassPane>
    );

    return (
        <SceneContainer backUrl={`/${topicId || 'probability'}`} controls={controls}>
            <SceneCanvas camera={{ position: [3, 3, 6], fov: 50 }} style={{ width: '100%', height: '100%' }} aria-label="3D bar chart showing Bayes theorem probability components">
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, 2, 3]} intensity={0.5} color="#fd79a8" />
                <BayesBlocks prior={prior} likelihood={likelihood} evidence={evidence} />
                <OrbitControls enableDamping dampingFactor={0.05} />
                <fog attach="fog" args={['#0b0f19', 6, 18]} />
                <color attach="background" args={['#0b0f19']} />
            </SceneCanvas>
        </SceneContainer>
    );
}
