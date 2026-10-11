import { VIZ } from '../../data/palette';
import { useEffect, useId, useMemo, useState } from 'react';
import type { TreeNode } from '../../utils/ml-trees';
import { treeDiagramLayout, treeNodeRule } from '../../utils/ml-tree-space';

interface TreeDiagramProps {
    tree: TreeNode;
    path: readonly TreeNode[];
    selectedId: number;
    compact?: boolean;
    onSelect?: (node: TreeNode) => void;
}

/** A graph's position means parent/child structure, not a feature or prediction axis. */
export function TreeDiagram({ tree, path, selectedId, compact = false, onSelect }: TreeDiagramProps) {
    const titleId = useId();
    const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 768px)').matches));
    useEffect(() => {
        const media = window.matchMedia?.('(max-width: 768px)');
        if (!media) return;
        const update = () => setMobile(media.matches);
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    const layout = useMemo(() => treeDiagramLayout(tree), [tree]);
    const selectedIndex = path.findIndex(node => node.id === selectedId);
    const visited = new Set(path.slice(0, selectedIndex + 1).map(node => node.id));
    const wholePath = new Set(path.map(node => node.id));
    const width = mobile && !compact ? 420 : 900;
    const height = mobile && !compact ? 460 : 390;
    const position = (id: number) => { const [x, y] = layout.positions.get(id)!; return [x * width, y * height]; };
    return <svg className="tree-diagram" viewBox={`0 0 ${width} ${height}`} role={onSelect ? 'group' : 'img'} aria-labelledby={titleId}>
        <title id={titleId}>Actual fitted tree: gold edges follow the query; white ring marks the inspected node. Left edges mean ≤, right edges mean &gt;. Graph height means tree depth.</title>
        {layout.cells.flatMap(({ node }) => [node.left, node.right].flatMap((child, side) => {
            if (!child) return [];
            const [x, y] = position(node.id); const [cx, cy] = position(child.id);
            return [<g key={`${node.id}-${child.id}`}><path d={`M${x},${y} L${cx},${cy}`} fill="none"
                stroke={visited.has(child.id) ? VIZ.focus : wholePath.has(child.id) ? VIZ.focusDim : VIZ.muted} strokeWidth={visited.has(child.id) ? 5 : 2} />
                {!compact && wholePath.has(child.id) && <text x={(x + cx) / 2 + (side === 0 ? -12 : 12)} y={(y + cy) / 2} textAnchor="middle" fill={VIZ.focus} fontSize={14}>{side === 0 ? '≤' : '>'}</text>}</g>];
        }))}
        {layout.cells.map(({ node }) => {
            const [x, y] = position(node.id); const selected = node.id === selectedId;
            const labelX = Math.max(67, Math.min(width - 67, x));
            const label = treeNodeRule(node); const leaf = !node.left || !node.right;
            return <g key={node.id} role={onSelect ? 'button' : undefined} tabIndex={onSelect && !compact ? 0 : undefined}
                aria-label={`Inspect node ${node.id + 1}: ${label}`} aria-pressed={onSelect ? selected : undefined}
                onClick={onSelect ? () => onSelect(node) : undefined}
                onKeyDown={onSelect ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node); } } : undefined}
                className={onSelect ? 'tree-diagram-node' : undefined}>
                <title>{label}; {node.indices.length} training rows; depth {node.depth}</title>
                <circle cx={x} cy={y} r={compact ? selected ? 14 : 9 : selected ? 13 : 9} fill={visited.has(node.id) ? VIZ.focus : leaf ? VIZ.truth : VIZ.data}
                    stroke={selected ? VIZ.white : VIZ.surface} strokeWidth={selected ? 4 : 2} />
                {!compact && wholePath.has(node.id) && <><rect x={labelX - 66} y={y - 37} width={132} height={23} rx={5} fill={VIZ.background} opacity={0.93} />
                    <text x={labelX} y={y - 20} textAnchor="middle" fill={selected ? VIZ.white : VIZ.focus} fontSize={15}>{label}</text></>}
            </g>;
        })}
    </svg>;
}
