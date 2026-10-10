import { useId } from 'react';
import type { LessonGuide as LessonGuideData } from '../data/lessonGuides';

interface LessonGuideProps { guide: LessonGuideData; }

export default function LessonGuide({ guide }: LessonGuideProps) {
    const id = useId();
    return <section className="lesson-guide" aria-labelledby={id}>
        <h2 id={id}>What this shows</h2>
        <p>{guide.meaning}</p>
        <h3>How to use it</h3>
        <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <h3>What to notice</h3>
        <p>{guide.observe}</p>
        {guide.limitations && <p className="lesson-guide-limitation">{guide.limitations}</p>}
    </section>;
}
