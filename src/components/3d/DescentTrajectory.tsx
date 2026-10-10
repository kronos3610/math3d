import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import type { Objective, Point2 } from '../../utils/optimization';

interface DescentTrajectoryProps {
    path: Point2[];
    loss: Objective;
    playing?: boolean;
    color: string;
}

export function DescentTrajectory({ path, loss, playing = true, color }: DescentTrajectoryProps) {
    const ballRef = useRef<THREE.Mesh>(null);
    const elapsed = useRef(0);
    const points = useMemo(() => path.map(([x, y]): [number, number, number] =>
        [x, loss(x, y) + 0.15, y]), [path, loss]);

    useFrame((_, delta) => {
        if (!ballRef.current) return;
        if (playing) elapsed.current += Math.min(delta, 0.1) * 20;
        const index = Math.min(Math.floor(elapsed.current), path.length - 1);
        const next = Math.min(index + 1, path.length - 1);
        const fraction = Math.min(elapsed.current - index, 1);
        const x = THREE.MathUtils.lerp(path[index][0], path[next][0], fraction);
        const y = THREE.MathUtils.lerp(path[index][1], path[next][1], fraction);
        ballRef.current.position.set(x, loss(x, y) + 0.15, y);
    });

    return (
        <>
            <Sphere ref={ballRef} args={[0.12, 16, 16]} position={points[0]}>
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
            </Sphere>
            {points.length > 1 && <Line points={points} color={color} lineWidth={2} transparent opacity={0.5} />}
        </>
    );
}
