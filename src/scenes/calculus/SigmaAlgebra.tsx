import { useState } from 'react';
import { SpatialScene, type LabVector } from '../../components/3d/SpatialScene';
import { VisualLab, LabRange, LabSelect } from '../../components/layout/VisualLab';
import { VIZ } from '../../data/palette';
import Latex from '../../components/Latex';

type SigmaMode = 'atoms' | 'complement' | 'union' | 'universe';

/** Finite partitions make the closure rules inspectable without pretending to draw non-measurable sets. */
export default function SigmaAlgebra() {
    const [sigmaLevel, setSigmaLevel] = useState(2);
    const [sigmaMode, setSigmaMode] = useState<SigmaMode>('atoms');
    const [selectedAtom, setSelectedAtom] = useState(0);
    const atomCount = 2 ** sigmaLevel; const atomSize = 16 / atomCount;
    const activeAtom = Math.min(selectedAtom, atomCount - 1); const secondAtom = (activeAtom + 1) % atomCount;
    const inA = (index: number) => Math.floor(index / atomSize) === activeAtom;
    const inB = (index: number) => Math.floor(index / atomSize) === secondAtom;
    const countA = atomSize; const countComplement = 16 - countA; const countUnion = atomCount === 1 ? 16 : 2 * atomSize;
    const boxes = Array.from({ length: 16 }, (_, index) => {
        const a = inA(index); const b = inB(index);
        const included = sigmaMode === 'universe' || (sigmaMode === 'complement' ? !a : sigmaMode === 'union' ? a || b : a);
        const color = sigmaMode === 'universe' ? VIZ.truth : sigmaMode === 'complement' ? a ? VIZ.data : VIZ.output
            : sigmaMode === 'union' ? included ? VIZ.output : VIZ.muted : a ? VIZ.focus : VIZ.data;
        return { position: [index % 4 - 1.5, 0, Math.floor(index / 4) - 1.5] as LabVector, size: [0.82, 0.3, 0.82] as LabVector,
            color, opacity: included ? 0.75 : 0.23, label: `${index + 1}` };
    });
    const description = sigmaMode === 'atoms' ? `The partition has ${atomCount} atoms, each containing ${atomSize} of the 16 outcomes. Events are unions of entire atoms.`
        : sigmaMode === 'complement' ? `A contains ${countA} ${countA === 1 ? 'outcome' : 'outcomes'}. Its complement contains the other ${countComplement}; together they recover Ω.`
        : sigmaMode === 'union' ? `A and B are measurable atoms. A ∪ B contains ${countUnion} outcomes and is still a union of whole atoms.`
        : 'Ω contains all 16 outcomes; the empty event contains none. Both belong to every σ-algebra on this space.';
    return <VisualLab title="σ-algebra: which events can we distinguish?" subtitle="A finite universe has 16 numbered outcomes. Change its partition, then inspect the closure rules."
        backUrl="/calculus" metrics={[{ label: 'Atoms', value: atomCount }, { label: 'Outcomes in A', value: countA },
            { label: 'Outcomes in Aᶜ', value: countComplement }, { label: 'Events in this σ-algebra', value: 2 ** atomCount }]}
        legend={sigmaMode === 'complement' ? [{ label: 'A', meaning: 'given event', color: VIZ.data, shape: 'square' }, { label: 'Aᶜ', meaning: 'complement output', color: VIZ.output, shape: 'square' }]
            : sigmaMode === 'union' ? [{ label: 'A ∪ B', meaning: 'union output', color: VIZ.output, shape: 'square' }, { label: 'Outside', meaning: 'other outcomes', color: VIZ.muted, shape: 'square' }]
            : sigmaMode === 'universe' ? [{ label: 'Ω', meaning: 'all outcomes', color: VIZ.truth, shape: 'square' }]
            : [{ label: 'A', meaning: 'selected atom', color: VIZ.focus, shape: 'square' }, { label: 'Other atoms', meaning: 'given outcomes', color: VIZ.data, shape: 'square' }]}
        controls={<><LabRange label="Granularity Level" value={sigmaLevel} min={0} max={4} onChange={value => { setSigmaLevel(value); setSelectedAtom(0); }} />
            <LabSelect label="Closure rule" value={sigmaMode} options={[{ value: 'atoms', label: 'Information resolution: atoms' }, { value: 'universe', label: 'Universe and empty event' },
                { value: 'complement', label: 'Complement rule' }, { value: 'union', label: 'Union rule' }]} onChange={value => setSigmaMode(value as SigmaMode)} />
            <LabSelect label="Select atom A" value={String(activeAtom)} options={Array.from({ length: atomCount }, (_, index) => ({ value: String(index), label: `Atom ${index + 1}: outcomes ${index * atomSize + 1}–${(index + 1) * atomSize}` }))}
                onChange={value => setSelectedAtom(Number(value))} /></>}
        insight={description} challenge="At four atoms, can you select just outcome 1 as an event? Raise the resolution until it becomes a whole atom."
        explanation={<div className="lab-explanation"><p>A σ-algebra is a collection of events that contains Ω, is closed under complements, and is closed under countable unions. A measure is a separate function assigning sizes to those events.</p>
            <Latex formula="A\in\mathcal F\Rightarrow A^c\in\mathcal F,\qquad A_n\in\mathcal F\Rightarrow\bigcup_n A_n\in\mathcal F" display />
            <p>For a finite partition with k atoms, all 2ᵏ unions of atoms form a σ-algebra. B is the atom after A, wrapping around; with one atom A = B = Ω. This finite example illustrates closure, but cannot demonstrate the full behavior of countably infinite unions.</p>
            <p>The Banach–Tarski theorem uses non-Lebesgue-measurable pieces that cannot be rendered as ordinary patches. Being outside a chosen σ-algebra alone does not imply that a set is non-Lebesgue-measurable. No physical volume is created by these diagrams.</p></div>}>
        <SpatialScene axes={['outcome column', 'display thickness', 'outcome row']} description={`Finite σ-algebra with 16 outcomes. ${description}`} boxes={boxes} />
    </VisualLab>;
}
