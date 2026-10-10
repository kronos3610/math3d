import { useId } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    getLearningPaths, getLessonRelationships, getMLSection, getPathNavigation, lessonUrl, resolveLesson,
    type LessonReference,
} from '../data/mlCurriculum';

function LessonLink({ reference, pathId }: { reference: LessonReference; pathId?: string | null }) {
    const lesson = resolveLesson(reference);
    if (!lesson) return null;
    return <Link to={lessonUrl(reference, pathId)} onFocus={() => lesson.subtopic.component.preload()}>
        {lesson.title}<span className="lesson-link-topic">{lesson.topicTitle}</span>
    </Link>;
}

function ConnectionGroup({ title, lessons, pathId }: { title: string; lessons: readonly LessonReference[]; pathId: string | null }) {
    if (!lessons.length) return null;
    return <section className="lesson-connection-group" aria-label={title}>
        <h3>{title}</h3>
        <ul>{lessons.map(reference => <li key={lessonUrl(reference)}><LessonLink reference={reference} pathId={pathId} /></li>)}</ul>
    </section>;
}

export default function LessonConnections() {
    const { topicId, subtopicId } = useParams<{ topicId: string; subtopicId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const selectorId = useId();
    if (!topicId || !subtopicId) return null;
    const reference = { topicId, subtopicId };
    const lesson = resolveLesson(reference);
    if (!lesson) return null;
    const pathId = searchParams.get('path');
    const navigation = getPathNavigation(pathId, reference);
    const paths = getLearningPaths(reference);
    const relationships = getLessonRelationships(reference);
    const algorithms = relationships.related.filter(related => related.topicId === 'ml' && getMLSection(related.subtopicId)?.id === 'algorithms');
    const concepts = relationships.related.filter(related => related.topicId !== 'ml' || getMLSection(related.subtopicId)?.id === 'concepts');
    const section = topicId === 'ml' ? getMLSection(subtopicId) : undefined;
    return (
        <div className="lesson-connections">
            <h2>Connect this lesson</h2>
            <p className="lesson-connections-intro">{lesson.title} connects to the models and mathematical ideas below.</p>
            {paths.length > 0 && (
                <section className="lesson-path-navigation" aria-label="Learning path">
                    <label htmlFor={selectorId}>Follow a learning path</label>
                    <select
                        id={selectorId}
                        value={navigation?.path.id ?? ''}
                        onChange={event => navigate(lessonUrl(reference, event.target.value))}
                    >
                        <option value="">Explore freely</option>
                        {paths.map(path => <option key={path.id} value={path.id}>{path.title}</option>)}
                    </select>
                    {navigation && (
                        <>
                            <p className="lesson-path-progress">Lesson {navigation.index + 1} of {navigation.path.lessons.length}</p>
                            <p className="lesson-path-description">{navigation.path.description}</p>
                            <nav className="lesson-path-steps" aria-label="Previous and next lessons">
                                {navigation.previous && <div><span>← Previous</span><LessonLink reference={navigation.previous} pathId={navigation.path.id} /></div>}
                                {navigation.next ? <div><span>Next →</span><LessonLink reference={navigation.next} pathId={navigation.path.id} /></div> : <p>You have reached the end of this path. Explore a connected concept or choose another path.</p>}
                            </nav>
                        </>
                    )}
                </section>
            )}
            <ConnectionGroup title="Build on these lessons" lessons={relationships.prerequisites} pathId={pathId} />
            <ConnectionGroup title="Related concepts" lessons={concepts} pathId={pathId} />
            <ConnectionGroup title={topicId === 'ml' ? 'Connected algorithms' : 'Use this in machine learning'} lessons={algorithms} pathId={pathId} />
            <Link className="lesson-curriculum-back" to={section ? `/ml?section=${section.id}` : '/ml'}>Browse {section?.title.toLowerCase() ?? 'machine learning'} →</Link>
        </div>
    );
}
