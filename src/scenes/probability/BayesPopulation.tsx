import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Label } from '../../components/3d/Label';
import type { BayesParameters } from '../../utils/bayes';
import { createBayesPopulationLayout } from './bayesPopulationLayout';
import { useSceneMotion } from '../../hooks/useSceneMotion';
import type { BayesBoard, BayesPopulationLayout, BayesView } from './bayesPopulationLayout';

export type { BayesView } from './bayesPopulationLayout';

interface BayesPopulationProps { parameters: BayesParameters; view: BayesView; }

interface TileTransition {
    start: Float32Array;
    target: Float32Array;
    elapsed: number;
    active: boolean;
}

function subscribeReducedMotion(listener: () => void): () => void {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
}

function getReducedMotion(): boolean {
    return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function formatCount(value: number): string {
    return Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-8 ? String(Math.round(value)) : value.toFixed(2);
}

function PopulationBoard({ board, name }: { board: BayesBoard; name: string }) {
    return <mesh position={[board.position[0], board.position[1], -0.18]} name={name}>
        <boxGeometry args={[board.width + 0.6, board.height + 0.6, 0.08]} />
        <meshLambertMaterial color="#142236" />
    </mesh>;
}

function fitCamera(layout: BayesPopulationLayout, camera: THREE.OrthographicCamera, width: number, height: number): void {
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const corner = new THREE.Vector3();
    for (const x of [layout.bounds.minimum[0], layout.bounds.maximum[0]]) {
        for (const y of [layout.bounds.minimum[1], layout.bounds.maximum[1]]) {
            for (const z of [layout.bounds.minimum[2], layout.bounds.maximum[2]]) {
                corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
                minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
                minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
            }
        }
    }
    // Leave screen space for the surrounding heading, controls, and teaching note.
    const availableWidth = Math.max(0.45, (width - 48) / Math.max(width, 1));
    const availableHeight = Math.max(0.45, (height - 80) / Math.max(height, 1));
    camera.zoom = Math.min(
        (camera.right - camera.left) * availableWidth / Math.max(1, maxX - minX),
        (camera.top - camera.bottom) * availableHeight / Math.max(1, maxY - minY),
    );
    camera.updateProjectionMatrix();
}

/** One shared box geometry/material renders all weighted email pieces. */
export function BayesPopulation({ parameters, view }: BayesPopulationProps) {
    const { size, camera, invalidate } = useThree();
    const { prior, likelihood, falsePositiveRate, population: specifiedPopulation } = parameters;
    const orientation = size.width < size.height ? 'vertical' : 'horizontal';
    const layout = useMemo(() => createBayesPopulationLayout({ prior, likelihood, falsePositiveRate, population: specifiedPopulation }, view, orientation),
        [prior, likelihood, falsePositiveRate, specifiedPopulation, view, orientation]);
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const previousMesh = useRef<THREE.InstancedMesh | null>(null);
    const pose = useMemo(() => new THREE.Object3D(), []);
    const matrix = useMemo(() => new THREE.Matrix4(), []);
    const colors = useMemo(() => ({
        spam: new THREE.Color('#fbbf24'), ordinary: new THREE.Color('#60a5fa'),
        dimSpam: new THREE.Color('#806327'), dimOrdinary: new THREE.Color('#24405c'),
    }), []);
    const moving = useSceneMotion();
    const systemReducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
    const reducedMotion = systemReducedMotion || !moving;
    const transition = useRef<TileTransition>({ start: new Float32Array(0), target: new Float32Array(0), elapsed: 0, active: false });

    useLayoutEffect(() => {
        if (camera instanceof THREE.OrthographicCamera) fitCamera(layout, camera, size.width, size.height);
        invalidate();
    }, [layout, camera, size.width, size.height, invalidate]);

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const snap = previousMesh.current !== mesh || reducedMotion;
        const start = new Float32Array(layout.pieces.length * 6);
        const target = new Float32Array(layout.pieces.length * 6);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let index = 0; index < layout.pieces.length; index++) {
            const piece = layout.pieces[index];
            const offset = index * 6;
            if (!snap) {
                mesh.getMatrixAt(index, matrix);
                matrix.decompose(pose.position, pose.quaternion, pose.scale);
                start.set([pose.position.x, pose.position.y, pose.position.z, pose.scale.x, pose.scale.y, pose.scale.z], offset);
            }
            target.set([...piece.position, ...piece.scale], offset);
            if (snap) {
                pose.position.set(...piece.position); pose.scale.set(...piece.scale); pose.quaternion.identity(); pose.updateMatrix();
                mesh.setMatrixAt(index, pose.matrix);
            }
            const dim = view !== 'population' && !piece.flagged;
            mesh.setColorAt(index, piece.event ? dim ? colors.dimSpam : colors.spam : dim ? colors.dimOrdinary : colors.ordinary);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        transition.current = { start, target, elapsed: 0, active: !snap };
        previousMesh.current = mesh;
        invalidate();
    }, [layout, view, reducedMotion, matrix, pose, colors, invalidate]);

    useFrame((_, delta) => {
        const mesh = meshRef.current;
        const animation = transition.current;
        if (!mesh || !animation.active) return;
        animation.elapsed = Math.min(0.65, animation.elapsed + delta);
        const progress = animation.elapsed / 0.65;
        const eased = progress * progress * (3 - 2 * progress);
        for (let index = 0; index < mesh.count; index++) {
            const offset = index * 6;
            const begin = animation.start;
            const end = animation.target;
            pose.position.set(begin[offset] + (end[offset] - begin[offset]) * eased,
                begin[offset + 1] + (end[offset + 1] - begin[offset + 1]) * eased,
                begin[offset + 2] + (end[offset + 2] - begin[offset + 2]) * eased);
            pose.scale.set(begin[offset + 3] + (end[offset + 3] - begin[offset + 3]) * eased,
                begin[offset + 4] + (end[offset + 4] - begin[offset + 4]) * eased,
                begin[offset + 5] + (end[offset + 5] - begin[offset + 5]) * eased);
            pose.quaternion.identity(); pose.updateMatrix(); mesh.setMatrixAt(index, pose.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        animation.active = progress < 1;
        if (animation.active) invalidate();
    });

    const population = parameters.population ?? 1000;
    const sourceCount = view === 'conditional' ? population - layout.result.evidenceCount : population;
    return <group name="bayes-population">
        <PopulationBoard board={layout.sourceBoard} name="source-email-board" />
        {layout.selectedBoard && <PopulationBoard board={layout.selectedBoard} name="flagged-email-board" />}
        <instancedMesh key={layout.pieces.length} ref={meshRef} args={[undefined, undefined, layout.pieces.length]}
            name="email-tiles" frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshLambertMaterial color="white" />
        </instancedMesh>
        <Label text={`${view === 'conditional' ? 'Not flagged' : 'All emails'} · ${formatCount(sourceCount)}`}
            position={layout.sourceBoard.labelPosition} fontSize={0.8} color="#cbd5e1" />
        {layout.selectedBoard && <Label text={`Flagged group · ${formatCount(layout.result.evidenceCount)}`}
            position={layout.selectedBoard.labelPosition} fontSize={0.8} color="#f8fafc" />}
        {!layout.selectedBoard && view === 'conditional' && <Label text="No emails are flagged"
            position={[0, -layout.sourceBoard.height / 2 - 0.75, 0]} fontSize={0.75} color="#f8fafc" />}
    </group>;
}
