import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useParams } from 'react-router-dom';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VisualLab, LabRange } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';

// --- Types ---
interface Camper {
    x: number;
    z: number;
}

// --- Constants ---
const CAMPERS: Camper[] = [
    { x: -2, z: -1 }, { x: -1.5, z: 1 }, { x: 0, z: 0 },
    { x: 1, z: -2 }, { x: 1.5, z: 1.5 }, { x: 2, z: -0.5 },
    { x: 3, z: 2 }, { x: -3, z: -2 }, { x: 0.5, z: 3 }
];

// --- Helper Functions ---
const calculateScore = (mx: number, mz: number, s: number) => {
    return CAMPERS.reduce((acc, p) => {
        const distSq = Math.pow(p.x - mx, 2) + Math.pow(p.z - mz, 2);
        const logLikelihood = -Math.log(2 * Math.PI) - 2 * Math.log(s) - (distSq / (2 * Math.pow(s, 2)));
        return acc + logLikelihood;
    }, 0);
};

export function ProbabilityDome({ muX, muZ, sigma }: { muX: number, muZ: number, sigma: number }) {
    const geometry = useMemo(() => {
        const dome = new THREE.PlaneGeometry(12, 12, 60, 60);
        // Work in world XZ coordinates so increasing muZ moves the peak toward +Z.
        dome.rotateX(-Math.PI / 2);
        const positions = dome.getAttribute('position');
        const denominator = 2 * sigma ** 2;
        const peakHeight = 15 / sigma;
        for (let i = 0; i < positions.count; i++) {
            const distanceSquared = (positions.getX(i) - muX) ** 2 + (positions.getZ(i) - muZ) ** 2;
            positions.setY(i, Math.max(0.05, peakHeight * Math.exp(-distanceSquared / denominator)));
        }
        positions.needsUpdate = true;
        dome.computeVertexNormals();
        dome.computeBoundingSphere();
        return dome;
    }, [muX, muZ, sigma]);

    // These shared geometries are supplied as mesh props rather than R3F-managed children.
    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <group>
            <mesh geometry={geometry}>
                <meshPhongMaterial
                    color={VIZ.output}
                    transparent
                    opacity={0.5}
                    side={THREE.DoubleSide}
                    shininess={60}
                    flatShading={false}
                />
            </mesh>
            <mesh geometry={geometry}>
                <meshBasicMaterial
                    color={VIZ.output}
                    wireframe
                    transparent
                    opacity={0.1}
                />
            </mesh>
        </group>
    );
}

export default function LogLikelihood() {
    const { topicId } = useParams();
    const [muX, setMuX] = useState(0);
    const [muZ, setMuZ] = useState(0);
    const [sigma, setSigma] = useState(2);
    const currentScore = calculateScore(muX, muZ, sigma);
    const vertices = useMemo(() => Array.from({ length: 61 * 61 }, (_, index): LabVector => {
        const x = -6 + 12 * (index % 61) / 60; const z = -6 + 12 * Math.floor(index / 61) / 60;
        const distanceSquared = (x - muX) ** 2 + (z - muZ) ** 2;
        return [x, Math.max(0.05, 15 / sigma * Math.exp(-distanceSquared / (2 * sigma ** 2))), z];
    }), [muX, muZ, sigma]);
    const outliers = CAMPERS.filter(point => ((point.x - muX) ** 2 + (point.z - muZ) ** 2) / sigma ** 2 > 6.25).length;
    const points = CAMPERS.map((point, index) => ({ position: [point.x, 0.2, point.z] as LabVector,
        color: ((point.x - muX) ** 2 + (point.z - muZ) ** 2) / sigma ** 2 > 6.25 ? VIZ.error : VIZ.data, radius: 0.16, label: String(index + 1) }));
    return <VisualLab title="Log-likelihood" subtitle="Move and resize the Gaussian model. Every observation adds one log-density to the score."
        backUrl={`/${topicId || 'probability'}`} metrics={[{ label: 'Exact log-likelihood', value: currentScore.toFixed(2) },
            { label: 'Observations', value: CAMPERS.length }, { label: 'Beyond 2.5σ', value: outliers }, { label: 'Mean (μx, μz)', value: `(${muX.toFixed(1)}, ${muZ.toFixed(1)})` }]}
        legend={[{ label: 'Dome', meaning: 'Gaussian model with rescaled height', color: VIZ.output, shape: 'square' },
            { label: 'Observations', meaning: 'given data', color: VIZ.data }, { label: 'Red observations', meaning: 'standardized distance > 2.5', color: VIZ.error }, { label: 'μ', meaning: 'current mean', color: VIZ.focus }]}
        controls={<><LabRange label="X-Position" value={muX} min={-5} max={5} step={0.1} decimals={1} onChange={setMuX} />
            <LabRange label="Z-Position" value={muZ} min={-5} max={5} step={0.1} decimals={1} onChange={setMuZ} />
            <LabRange label="Spread" value={sigma} min={0.1} max={4} step={0.1} decimals={1} onChange={setSigma} /></>}
        insight={`All nine points contribute to log-likelihood ${currentScore.toFixed(2)}. ${outliers} ${outliers === 1 ? 'point is' : 'points are'} beyond 2.5σ; none has zero Gaussian density.`}
        challenge="Make the dome very narrow. Its peak rises, but does the total score improve when it misses most observations?"
        explanation={<div className="lab-explanation"><p>The score is Σ[−ln(2π) − 2 ln σ − ‖xᵢ−μ‖²/(2σ²)] for an isotropic two-dimensional Gaussian. Higher is better for these fixed observations.</p>
            <p>The dome lives in data space, with height rescaled as 15/σ times the Gaussian shape and clipped below at 0.05. Height is not calibrated density. The displayed height axis is scaled separately from the equal-unit data floor. This is a manually controlled model, not an optimizer or a surface over likelihood parameters.</p></div>}>
        <SpatialScene axes={['data x', 'rescaled height', 'data z']} equalScale={false} equalAxes={[0, 2]}
            description="A Gaussian data-space dome, nine fixed observations, and the current mean. Red observations are farther than 2.5 standard deviations; all contribute to the exact log score."
            surfaces={[{ vertices, columns: 61, color: VIZ.output, opacity: 0.28 }]} points={[...points, { position: [muX, 0.3, muZ], color: VIZ.focus, radius: 0.18, label: 'μ' }]} />
    </VisualLab>;
}
