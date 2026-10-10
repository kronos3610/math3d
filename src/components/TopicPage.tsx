import { useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getTopicById, type Topic, type Subtopic } from '../data/topics';
import { learningPaths, lessonUrl, mlFoundations, mlSections, resolveLesson } from '../data/mlCurriculum';
import SubtopicCardPreview from './SubtopicCardPreview';

const ML_SEARCH_ALIASES: Readonly<Record<string, string>> = {
    'hidden-markov-models': 'HMM Baum Welch',
    'bagging-random-forests': 'random forest RF OOB',
    boosting: 'AdaBoost gradient boosting',
    'support-vector-regression': 'SVR',
    'transformer-architectures': 'BERT GPT T5',
    'transformer-cache': 'grouped query multi query multi head latent GQA MQA MHA MLA',
    'memory-gradients': 'BPTT backpropagation through time',
    'state-space-models': 'SSM',
    'signal-to-noise': 'SNR',
    'neural-networks': 'MLP feedforward XOR backpropagation',
};

interface LessonCardProps {
    topic: Topic;
    subtopic: Subtopic;
    index: number;
}

function LessonCard({ topic, subtopic, index }: LessonCardProps) {
    const Heading = topic.id === 'ml' ? 'h4' : 'h3';
    return (
        <Link
            to={`/${topic.id}/${subtopic.id}`}
            className={`subtopic-card fade-in-up stagger-${index + 1}`}
            onMouseEnter={() => subtopic.component.preload()}
            onFocus={() => subtopic.component.preload()}
        >
            <div className="subtopic-card-preview">
                <SubtopicCardPreview color={topic.color} />
            </div>
            <div className="subtopic-card-body">
                <Heading className="subtopic-card-title">{subtopic.title}</Heading>
                <p className="subtopic-card-description">{subtopic.description}</p>
            </div>
            <div className="subtopic-card-footer">
                <span className="subtopic-card-tag">{subtopic.visualization === 'experiment' ? 'Interactive experiment' : 'Interactive 3D'}</span>
                <span className="subtopic-card-open">Explore →</span>
            </div>
        </Link>
    );
}

function MLCurriculum({ topic, selectedSection }: { topic: Topic; selectedSection: string | null }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const searchInput = useRef<HTMLInputElement>(null);
    const query = searchParams.get('q') ?? '';
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const sections = mlSections.filter(section => !['algorithms', 'concepts'].includes(selectedSection ?? '') || section.id === selectedSection);
    const availableCount = sections.reduce((total, section) => total + section.families.reduce((count, family) => count + family.lessonIds.length, 0), 0);
    const filteredSections = sections.map(section => ({
        ...section,
        families: section.families.map(family => ({
            ...family,
            lessons: family.lessonIds.flatMap(id => {
                const lesson = topic.subtopics.find(candidate => candidate.id === id);
                if (!lesson) return [];
                const searchable = `${lesson.title} ${lesson.description} ${lesson.id.replaceAll('-', ' ')} ${family.title} ${ML_SEARCH_ALIASES[lesson.id] ?? ''}`.toLocaleLowerCase();
                return terms.every(term => searchable.includes(term)) ? [lesson] : [];
            }),
        })).filter(family => family.lessons.length > 0),
    })).filter(section => section.families.length > 0);
    const visibleCount = filteredSections.reduce((total, section) => total + section.families.reduce((count, family) => count + family.lessons.length, 0), 0);
    const updateQuery = (value: string) => {
        setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            if (value) next.set('q', value);
            else next.delete('q');
            return next;
        }, { replace: true });
    };
    const sectionUrl = (section?: string) => {
        const next = new URLSearchParams();
        if (section) next.set('section', section);
        if (query) next.set('q', query);
        return `/ml${next.size ? `?${next.toString()}` : ''}`;
    };
    return (
        <>
            <nav className="ml-section-nav" aria-label="Machine learning sections">
                <Link to={sectionUrl()} aria-current={sections.length === 2 ? 'page' : undefined}>All lessons</Link>
                {mlSections.map(section => (
                    <Link key={section.id} to={sectionUrl(section.id)} aria-current={selectedSection === section.id ? 'page' : undefined}>
                        {section.title}
                    </Link>
                ))}
                <a href="#ml-learning-paths">Learning paths ↓</a>
            </nav>

            <div className="ml-lesson-search" role="search" aria-label="Machine learning lessons">
                <label htmlFor="ml-lesson-query">Find a lesson</label>
                <div className="ml-search-controls">
                    <input ref={searchInput} id="ml-lesson-query" type="search" value={query} onChange={event => updateQuery(event.target.value)} placeholder="Try regression, gates, attention…" />
                    {query && <button type="button" className="lab-button" onClick={() => { updateQuery(''); searchInput.current?.focus(); }}>Clear search</button>}
                </div>
                <p role="status">{visibleCount} of {availableCount} lessons{terms.length > 0 ? ` match “${query.trim()}”` : ' in this view'}.</p>
            </div>

            {visibleCount > 0 ? <details className="ml-family-jumps">
                <summary>Jump to a family</summary>
                <nav className="ml-section-nav" aria-label="Machine learning families">
                    {filteredSections.flatMap(section => section.families.map(family => (
                        <a key={family.id} href={`#ml-family-${family.id}`}>{family.title} ({family.lessons.length})</a>
                    )))}
                </nav>
            </details> : <p className="ml-search-empty">No lessons match this search in the selected section. Try another term or choose All lessons.</p>}

            {filteredSections.map(section => (
                <section key={section.id} className="ml-curriculum-section" aria-labelledby={`ml-${section.id}-title`}>
                    <div className="ml-section-heading">
                        <h2 id={`ml-${section.id}-title`}>{section.title}</h2>
                        <p>{section.description}</p>
                    </div>
                    {section.families.map(family => (
                        <section key={family.id} className="ml-family" aria-labelledby={`ml-family-${family.id}`}>
                            <h3 id={`ml-family-${family.id}`} tabIndex={-1}>{family.title}</h3>
                            <p className="ml-family-description">{family.description}</p>
                            <div className="subtopic-grid">
                                {family.lessons.map((subtopic, index) => <LessonCard key={subtopic.id} topic={topic} subtopic={subtopic} index={index} />)}
                            </div>
                        </section>
                    ))}
                    {section.id === 'concepts' && (
                        <aside className="ml-foundations" aria-label="Mathematical foundations">
                            <h3>Mathematical foundations</h3>
                            <p>Explore the shared math behind these models in its original module.</p>
                            <div className="ml-foundation-links">
                                {mlFoundations.map(reference => {
                                    const lesson = resolveLesson(reference);
                                    return lesson ? <Link key={lessonUrl(reference)} to={lessonUrl(reference)}>{lesson.title}<span>{lesson.topicTitle}</span></Link> : null;
                                })}
                            </div>
                        </aside>
                    )}
                </section>
            ))}

            <section id="ml-learning-paths" className="ml-learning-paths" aria-labelledby="ml-paths-title">
                <div className="ml-section-heading">
                    <h2 id="ml-paths-title">Learning paths</h2>
                    <p>Follow a sequence from the mathematical foundations to a model or experiment. Open the Learn panel in any lesson to continue.</p>
                </div>
                <div className="ml-path-grid">
                    {learningPaths.map(path => (
                        <article key={path.id} className="ml-path-card">
                            <h3>{path.title}</h3>
                            <p>{path.description}</p>
                            <Link className="ml-path-start" to={lessonUrl(path.lessons[0], path.id)}>Start path <span aria-hidden="true">→</span></Link>
                            <details>
                                <summary>{path.lessons.length} lessons · View sequence</summary>
                                <ol>
                                    {path.lessons.map(reference => {
                                        const lesson = resolveLesson(reference);
                                        return lesson ? <li key={lessonUrl(reference)}><Link to={lessonUrl(reference, path.id)}>{lesson.title}<span>{lesson.topicTitle}</span></Link></li> : null;
                                    })}
                                </ol>
                            </details>
                        </article>
                    ))}
                </div>
            </section>
        </>
    );
}

export default function TopicPage() {
    const { topicId } = useParams<{ topicId: string }>();
    const [searchParams] = useSearchParams();
    const topic = topicId ? getTopicById(topicId) : undefined;

    if (!topic) {
        return (
            <div className="topic-page">
                <h1 className="topic-page-title">Topic Not Found</h1>
                <Link to="/" className="lab-button">Explore topics</Link>
                <p className="topic-page-description">The requested topic does not exist.</p>
            </div>
        );
    }

    return (
        <div className="topic-page">
            <div className="topic-page-header fade-in-up">
                <div className="topic-page-breadcrumb">
                    <Link to="/">Home</Link>
                    <span>›</span>
                    <span>{topic.title}</span>
                </div>
                <h1 className="topic-page-title" style={{ color: topic.color }}>
                    {topic.icon} {topic.title}
                </h1>
                <p className="topic-page-description">
                    {topic.id === 'ml'
                        ? 'Choose an algorithm, investigate a core concept, or follow a learning path that connects models to their mathematical foundations.'
                        : `Explore interactive 3D visualizations for ${topic.title.toLowerCase()} concepts. Click any card to launch the full visualization.`}
                </p>
            </div>

            {topic.id === 'ml' ? (
                <MLCurriculum topic={topic} selectedSection={searchParams.get('section')} />
            ) : (
                <div className="subtopic-grid">
                    {topic.subtopics.map((subtopic, index) => <LessonCard key={subtopic.id} topic={topic} subtopic={subtopic} index={index} />)}
                </div>
            )}
        </div>
    );
}
