import type { CSSProperties } from 'react';
import type { PreviewMotif } from '../data/topics';
import { VIZ } from '../data/palette';

interface SubtopicCardPreviewProps { color: string; preview?: PreviewMotif; }

export default function SubtopicCardPreview({ color, preview = 'surface' }: SubtopicCardPreviewProps) {
    return <div className="lesson-card-art" style={{ '--preview-color': color } as CSSProperties} aria-hidden="true">
        <svg viewBox="0 0 240 120" className="lesson-preview" data-motif={preview}>
            <g stroke={VIZ.axis} opacity="0.22" fill="none"><path d="M20 100 H220 M35 15 V105" />
                {[60,100,140,180].map(x => <path key={x} d={`M${x} 20 V100`} />)}</g>
            {preview === 'vectors' && <g fill="none" strokeWidth="3"><path stroke={VIZ.data} d="M70 95 L150 70 m-14 -3 14 3 -7 12" /><path stroke={VIZ.focus} d="M70 95 L105 28 m-12 9 12 -9 2 15" /><path stroke={VIZ.output} d="M70 95 L185 22 m-15 2 15 -2 -6 14" /><path stroke={VIZ.axis} strokeDasharray="4 4" d="M150 70 L185 22 L105 28" /></g>}
            {preview === 'bars' && <g fill={VIZ.truth}>{[30,48,66,80,66,44,24].map((h,i) => <rect key={i} x={45+i*22} y={100-h} width="18" height={h} opacity={0.4+i/15} />)}<path d="M40 70 Q90 0 140 40 T200 82" fill="none" stroke={VIZ.focus} strokeWidth="3" /></g>}
            {preview === 'bell' && <><path d="M30 100 C65 100 76 95 94 53 C112 4 131 4 149 53 C167 95 176 100 210 100" fill={VIZ.data} opacity="0.35" /><path d="M30 100 C65 100 76 95 94 53 C112 4 131 4 149 53 C167 95 176 100 210 100" fill="none" stroke={VIZ.truth} strokeWidth="3" /></>}
            {preview === 'scatter' && <><path d="M105 110 L143 15" stroke={VIZ.focus} strokeWidth="3" />{Array.from({length:24},(_,i)=><circle key={i} cx={42+(i%6)*29+(i%3)*4} cy={28+Math.floor(i/6)*20+(i%2)*7} r="4" fill={i%6<3?VIZ.data:VIZ.error} />)}</>}
            {preview === 'tree' && <g strokeWidth="2"><path d="M120 20 L70 55 M120 20 L170 55 M70 55 L45 95 M70 55 L95 95 M170 55 L145 95 M170 55 L195 95" stroke={VIZ.truth} fill="none" />{[[120,20],[70,55],[170,55],[45,95],[95,95],[145,95],[195,95]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="8" fill={i<3?VIZ.focus:VIZ.data} />)}</g>}
            {preview === 'network' && <g>{[35,65,95].flatMap(y=>[25,50,75,100].map(z=><path key={`${y}-${z}`} d={`M65 ${y} L120 ${z}`} stroke={VIZ.variation} opacity="0.5" />))}{[25,50,75,100].flatMap(y=>[45,80].map(z=><path key={`${y}-${z}`} d={`M120 ${y} L180 ${z}`} stroke={VIZ.variation} opacity="0.5" />))}{[65,120,180].flatMap((x,i)=>(i===0?[35,65,95]:i===1?[25,50,75,100]:[45,80]).map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill={i===0?VIZ.data:i===1?VIZ.focus:VIZ.output} />))}</g>}
            {preview === 'curve' && <><path d="M35 90 Q95 5 140 50 T210 40" fill="none" stroke={VIZ.truth} strokeWidth="3" />{Array.from({length:9},(_,i)=><circle key={i} cx={40+i*20} cy={75-25*Math.sin(i/2)+(i%2?9:-9)} r="4" fill={VIZ.data} />)}<path d="M40 100 L200 28" stroke={VIZ.focus} opacity="0.7" strokeWidth="2" /></>}
            {preview === 'cube' && <g fill={VIZ.output} fillOpacity="0.15" stroke={VIZ.output} strokeWidth="2"><path d="M75 40 L140 25 L185 50 L120 65 Z M75 40 V85 L120 108 V65 M120 108 L185 92 V50 M140 25 V70 L75 85 M140 70 L185 92" /></g>}
            {preview === 'sequence' && <g>{[0,1,2,3,4].map(i=><g key={i}><rect x={35+i*37} y={64} width="25" height="27" rx="4" fill={VIZ.data} /><path d={`M${48+i*37} 64 Q120 ${5+i*5} 195 64`} stroke={VIZ.variation} fill="none" opacity="0.7" /></g>)}<circle cx="195" cy="54" r="7" fill={VIZ.focus} /></g>}
            {preview === 'surface' && <g fill="none" stroke={VIZ.truth}>{Array.from({length:7},(_,i)=><path key={i} d={`M${32+i*14} ${85-i*5} Q${100+i*7} ${15+i*3} ${155+i*8} ${83-i*2}`} opacity={0.4+i/12} />)}<path d="M32 85 Q100 120 203 71" stroke={VIZ.focus} strokeWidth="3" /></g>}
        </svg>
    </div>;
}
