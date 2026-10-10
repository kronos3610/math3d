import { useEffect, useId, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { SceneCanvas } from './SceneCanvas';

import { spatialTransform } from './spatial-model';
import type { LabVector, SpatialPoint, SpatialSurface, SpatialVector, SpatialSceneProps } from './spatial-model';
export type { LabVector, SpatialPoint, SpatialPath, SpatialVector, SpatialBox, SpatialSurface, SpatialSceneProps } from './spatial-model';
const EMPTY: never[] = [];
const COLORS = { point: '#60a5fa', line: '#2dd4bf', x: '#fb7185', y: '#fbbf24', z: '#60a5fa' };
const axisValue = (value: number) => value === 0 ? '0' : Math.abs(value) < 0.01 || Math.abs(value) >= 10000 ? value.toExponential(1) : value.toPrecision(3);

function FitSpatialCamera({ extent }: { extent: LabVector }) {
    const { camera, size, invalidate } = useThree();
    const [x,y,z] = extent;
    useLayoutEffect(() => {
        if (!(camera instanceof THREE.PerspectiveCamera)) return;
        const direction = camera.position.clone().normalize();
        const oldDistance = camera.position.length();
        camera.lookAt(0,0,0); camera.updateMatrixWorld();
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const aspect = Math.max(0.2,size.width / Math.max(1,size.height));
        let distance = 6;
        for (const sx of [-1,1]) for (const sy of [-1,1]) for (const sz of [-1,1]) {
            const corner = new THREE.Vector3(sx * x / 2,sy * y / 2,sz * z / 2).applyMatrix4(camera.matrixWorldInverse);
            const depthOffset = corner.z + oldDistance;
            distance = Math.max(distance,Math.abs(corner.x) / (tangent * aspect * 0.82) + depthOffset,Math.abs(corner.y) / (tangent * 0.77) + depthOffset);
        }
        camera.position.copy(direction.multiplyScalar(distance)); camera.lookAt(0,0,0); camera.updateProjectionMatrix(); invalidate();
    }, [camera,size.width,size.height,x,y,z,invalidate]);
    return null;
}

function PointCloud({ points }: { points: readonly SpatialPoint[] }) {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const pose = useMemo(() => new THREE.Object3D(), []);
    const color = useMemo(() => new THREE.Color(), []);
    useLayoutEffect(() => {
        if (!mesh.current) return;
        points.forEach((point, index) => {
            pose.position.set(...point.position); pose.scale.setScalar(point.radius ?? 0.09); pose.updateMatrix();
            mesh.current!.setMatrixAt(index, pose.matrix);
            mesh.current!.setColorAt(index, color.set(point.color ?? COLORS.point));
        });
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    }, [points, pose, color]);
    if (points.length === 0) return null;
    return <instancedMesh key={points.length} ref={mesh} args={[undefined, undefined, points.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 8]} /><meshLambertMaterial />
    </instancedMesh>;
}

function Surface({ surface }: { surface: SpatialSurface }) {
    const geometry = useMemo(() => {
        const positions = new Float32Array(surface.vertices.flat());
        const indices: number[] = [];
        const rows = Math.floor(surface.vertices.length / surface.columns);
        for (let row = 0; row < rows - 1; row++) for (let column = 0; column < surface.columns - 1; column++) {
            const a = row * surface.columns + column; const b = a + 1; const c = a + surface.columns; const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
        const result = new THREE.BufferGeometry();
        result.setAttribute('position', new THREE.BufferAttribute(positions, 3)); result.setIndex(indices); result.computeVertexNormals();
        return result;
    }, [surface.vertices, surface.columns]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <mesh geometry={geometry}><meshLambertMaterial color={surface.color ?? COLORS.line} side={THREE.DoubleSide}
        transparent opacity={surface.opacity ?? 0.32} depthWrite={false} /></mesh>;
}

function Arrow({ vector }: { vector: SpatialVector }) {
    const delta = new THREE.Vector3(...vector.to).sub(new THREE.Vector3(...vector.from));
    const length = delta.length();
    if (length < 1e-9) return null;
    const direction = delta.clone().normalize();
    const side = new THREE.Vector3().crossVectors(direction, Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const back = new THREE.Vector3(...vector.to).addScaledVector(direction, -Math.min(0.25, length / 4));
    const a = back.clone().addScaledVector(side, Math.min(0.12, length / 8)).toArray() as LabVector;
    const b = back.clone().addScaledVector(side, -Math.min(0.12, length / 8)).toArray() as LabVector;
    return <group><Line points={[vector.from, vector.to]} color={vector.color ?? COLORS.line} lineWidth={2} />
        <Line points={[a, vector.to, b]} color={vector.color ?? COLORS.line} lineWidth={2} />
    </group>;
}

function mergeLabels(points: readonly SpatialPoint[], measure: (point: LabVector) => LabVector = point => point) {
    const labels: SpatialPoint[] = [];
    for (const point of points) {
        if (!point.label) continue;
        const position = measure(point.position);
        const index = labels.findIndex(previous => {
            const other = measure(previous.position);
            return position.reduce((sum,value,axis) => sum + (value - other[axis]) ** 2,0) < 0.04;
        });
        if (index < 0) labels.push(point);
        else {
            const previous = labels[index];
            const nearby = point.position.some((value,axis) => Math.abs(value - previous.position[axis]) > 1e-6);
            labels[index] = { ...previous, label:`${nearby && !previous.label!.startsWith('Nearby:') ? 'Nearby: ' : ''}${previous.label} / ${point.label}` };
        }
    }
    return labels;
}

function SpatialLabels({ points }: { points: readonly SpatialPoint[] }) {
    return <>{mergeLabels(points).map((point,index) => <Html key={index} center zIndexRange={[40,0]}
        position={[point.position[0],point.position[1] + 0.25,point.position[2]]} style={{pointerEvents:'none'}}>
        <div className="spatial-point-label" style={{color:point.color ?? '#e2e8f0'}}>{point.label!.split(' / ').map((label,line) => <span key={line}>{label}{line < point.label!.split(' / ').length - 1 ? ' /' : ''}</span>)}</div>
    </Html>)}</>;
}

function AccessibleOrbitControls({ description }: { description: string }) {
    const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
    const { gl,camera,invalidate } = useThree();
    useEffect(() => {
        const canvas = gl.domElement;
        canvas.setAttribute('tabindex','0');
        canvas.setAttribute('aria-label',`${description} Arrow keys rotate; plus and minus zoom.`);
        const offset = new THREE.Vector3(); const spherical = new THREE.Spherical();
        const keyDown = (event: KeyboardEvent) => {
            if (!controls.current || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key)) return;
            event.preventDefault();
            spherical.setFromVector3(offset.copy(camera.position).sub(controls.current.target));
            if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
            if (event.key === 'ArrowRight') spherical.theta += 0.12;
            if (event.key === 'ArrowUp') spherical.phi -= 0.12;
            if (event.key === 'ArrowDown') spherical.phi += 0.12;
            if (event.key === '+' || event.key === '=') spherical.radius = Math.max(5,spherical.radius * 0.9);
            if (event.key === '-') spherical.radius = Math.min(45,spherical.radius * 1.1);
            spherical.makeSafe(); camera.position.copy(offset.setFromSpherical(spherical).add(controls.current.target));
            controls.current.update(); invalidate();
        };
        canvas.addEventListener('keydown',keyDown);
        return () => canvas.removeEventListener('keydown',keyDown);
    }, [gl,camera,invalidate,description]);
    return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={5} maxDistance={45} />;
}

function SpatialFallback({ props }: { props: SpatialSceneProps }) {
    const id = useId();
    const transform = spatialTransform(props);
    const project = (point: LabVector) => { const [x, y, z] = transform.map(point); return [400 + 48 * x + 25 * z, 240 - 48 * y - 15 * z]; };
    const pathData = (points: readonly LabVector[], close = false) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${project(point).join(',')}`).join(' ') + (close ? ' Z' : '');
    return <figure className="spatial-fallback"><svg viewBox="0 0 800 480" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Spatial model — 2D projection</title><desc id={`${id}-desc`}>{props.description} This is an oblique 2D projection of the same computed coordinates.</desc>
        <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="context-stroke" /></marker></defs>
        {(props.surfaces ?? []).map((surface, index) => {
            const rows = Math.floor(surface.vertices.length / surface.columns);
            const corners = [surface.vertices[0], surface.vertices[surface.columns - 1], surface.vertices[rows * surface.columns - 1], surface.vertices[(rows - 1) * surface.columns]];
            return <g key={index}><path d={pathData(corners, true)} fill={surface.color ?? COLORS.line} opacity={surface.opacity ?? 0.25} />
                {Array.from({ length: rows }, (_, row) => <path key={row} d={pathData(surface.vertices.slice(row * surface.columns, (row + 1) * surface.columns))} fill="none" stroke={surface.color ?? COLORS.line} opacity={0.5} />)}</g>;
        })}
        {(props.boxes ?? []).map((box, index) => {
            const corners: LabVector[] = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(signs => box.position.map((value, axis) => value + signs[axis] * box.size[axis] / 2) as LabVector);
            return <g key={index}>{[[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6]].map((face, i) => <path key={i} d={pathData(face.map(corner => corners[corner]), true)} fill={box.color ?? COLORS.line} stroke={box.color ?? COLORS.line} opacity={box.opacity ?? 0.2} />)}
                </g>;
        })}
        {(props.paths ?? []).map((path, index) => <path key={index} d={pathData(path.points)} fill="none" stroke={path.color ?? COLORS.line} strokeWidth={path.width ?? 2} strokeDasharray={path.dashed ? '6 4' : undefined} />)}
        {(props.vectors ?? []).map((vector, index) => <path key={index} d={pathData([vector.from, vector.to])} fill="none" stroke={vector.color ?? COLORS.line} strokeWidth={3} markerEnd={`url(#${id}-arrow)`} />)}
        {(props.points ?? []).map((point, index) => <g key={index}><circle cx={project(point.position)[0]} cy={project(point.position)[1]} r={Math.max(3, (point.radius ?? 0.09) * 35)} fill={point.color ?? COLORS.point} />
            </g>)}
        {mergeLabels([...(props.points ?? []),...(props.vectors ?? []).map(vector => ({position:vector.to,label:vector.label,color:vector.color})),...(props.boxes ?? []).map(box => ({position:box.position,label:box.label,color:box.color}))],point => {
            const [x,y] = project(point); return [x / 240,y / 240,0];
        }).map((point,index) => {
            const lines = point.label!.split(' / '); const [x,y] = project(point.position);
            const labelY = Math.max(30,Math.min(470 - (lines.length - 1) * 32,y - 9 - (lines.length - 1) * 32));
            return <text key={index} x={x} y={labelY} textAnchor="middle" fill={point.color ?? 'var(--text-primary)'} fontSize={12}>{lines.map((line,i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 32}>{i > 0 ? ' ' : ''}{line}{i < lines.length - 1 ? ' /' : ''}</tspan>)}</text>;
        })}
    </svg><figcaption>2D projection · identical model calculations</figcaption></figure>;
}

export function SpatialScene(props: SpatialSceneProps) {
    const { points = EMPTY, paths = EMPTY, vectors = EMPTY, boxes = EMPTY, surfaces = EMPTY, axes = ['x', 'y', 'z'], description, equalScale = true, equalAxes } = props;
    const transformed = useMemo(() => {
        const transform = spatialTransform({ points, paths, vectors, boxes, surfaces, description, equalScale, equalAxes });
        return { transform,
            points: points.map(point => ({ ...point, position: transform.map(point.position) })),
            paths: paths.map(path => ({ ...path, points: path.points.map(transform.map) })),
            vectors: vectors.map(vector => ({ ...vector, from: transform.map(vector.from), to: transform.map(vector.to) })),
            boxes: boxes.map(box => ({ ...box, position: transform.map(box.position), size: box.size.map((value, axis) => value * transform.scale[axis]) as LabVector })),
            surfaces: surfaces.map(surface => ({ ...surface, vertices: surface.vertices.map(transform.map) })),
        };
    }, [points, paths, vectors, boxes, surfaces, description, equalScale, equalAxes]);
    const colors = [COLORS.x, COLORS.y, COLORS.z];
    const extent = transformed.transform.maximum.map((value,axis) => (value - transformed.transform.minimum[axis]) * transformed.transform.scale[axis]) as LabVector;
    return <div className="spatial-stage"><SceneCanvas camera={{ position: props.cameraPosition ?? [8, 6, -9], fov: 48 }} frameloop="demand" role="img" aria-label={description} fallback={<SpatialFallback props={props} />}>
        <FitSpatialCamera extent={extent} />
        <color attach="background" args={['#0b0f19']} /><ambientLight intensity={0.75} /><directionalLight position={[5, 10, 8]} intensity={1.2} />
        <PointCloud points={transformed.points} />
        <SpatialLabels points={[...transformed.points,...transformed.vectors.map(vector => ({ position:vector.to,label:vector.label,color:vector.color })),...transformed.boxes.map(box => ({ position:box.position,label:box.label,color:box.color }))]} />
        {transformed.paths.filter(path => path.points.length > 1).map((path, index) => <Line key={index} points={path.points} color={path.color ?? COLORS.line} lineWidth={path.width ?? 2} dashed={path.dashed} dashSize={0.12} gapSize={0.08} />)}
        {transformed.vectors.map((vector, index) => <Arrow key={index} vector={vector} />)}
        {transformed.boxes.map((box, index) => <mesh key={index} position={box.position}><boxGeometry args={box.size} /><meshLambertMaterial color={box.color ?? COLORS.line} transparent opacity={box.opacity ?? 0.25} depthWrite={false} /></mesh>)}
        {transformed.surfaces.map((surface, index) => <Surface key={index} surface={surface} />)}
        {axes.map((_, axis) => {
            const from: LabVector = [0,0,0]; const to: LabVector = [0,0,0];
            from[axis] = transformed.transform.minimum[axis]; to[axis] = transformed.transform.maximum[axis];
            return <Line key={axis} points={[transformed.transform.map(from), transformed.transform.map(to)]} color={colors[axis]} lineWidth={1} transparent opacity={0.6} />;
        })}
        <AccessibleOrbitControls description={description} />
    </SceneCanvas><div className="spatial-axis-key" aria-label="Coordinate axes">{axes.map((name,axis) => <span key={axis} style={{color:colors[axis]}}><strong>{['X','Y','Z'][axis]}</strong> {name} <small>{axisValue(transformed.transform.minimum[axis])} … {axisValue(transformed.transform.maximum[axis])}</small></span>)}
        {!equalScale && <small>{equalAxes ? `${equalAxes.map(axis => ['X','Y','Z'][axis]).join('/')} units equal; other axis scaled` : 'Axes scale independently'}</small>}
    </div></div>;
}
