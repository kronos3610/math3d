import { Link } from 'react-router-dom';
import { getTopicLearningPaths, lessonUrl, resolveLesson } from '../data/mlCurriculum';

export default function LearningPaths({ topicId }: { topicId: string }) {
    const paths = getTopicLearningPaths(topicId);
    return <section id={`${topicId}-learning-paths`} className="ml-learning-paths" aria-labelledby={`${topicId}-paths-title`}>
        <div className="ml-section-heading"><h2 id={`${topicId}-paths-title`}>Learning paths</h2>
            <p>Follow a sequence from the foundations to an experiment. Open the Learn panel in any lesson to continue.</p></div>
        <div className="ml-path-grid">{paths.map(path => <article key={path.id} className="ml-path-card">
            <h3>{path.title}</h3><p>{path.description}</p>
            <Link className="ml-path-start" to={lessonUrl(path.lessons[0], path.id)}>Start path <span aria-hidden="true">→</span></Link>
            <details><summary>{path.lessons.length} lessons · View sequence</summary><ol>{path.lessons.map(reference => {
                const lesson = resolveLesson(reference);
                return lesson ? <li key={lessonUrl(reference)}><Link to={lessonUrl(reference,path.id)}>{lesson.title}<span>{lesson.topicTitle}</span></Link></li> : null;
            })}</ol></details>
        </article>)}</div>
    </section>;
}
