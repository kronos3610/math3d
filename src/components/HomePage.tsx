import { Link } from 'react-router-dom';
import { topics } from '../data/topics';
import { lazy, Suspense } from 'react';

const HeroScene = lazy(() => import('./HeroScene'));

export default function HomePage() {
    return (
        <>
            <div className="hero">
                <div className="hero-canvas">
                    <Suspense fallback={null}><HeroScene /></Suspense>
                </div>
                <div className="hero-overlay" />
                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="hero-badge-dot" />
                        Interactive 3D Visualizations
                    </div>
                    <h1 className="hero-title">
                        <span className="hero-title-gradient">Mathematics</span>
                        <br />
                        Made Visual
                    </h1>
                    <p className="hero-subtitle">
                        Explore mathematical concepts through interactive 3D visualizations.
                        From linear algebra to machine learning — see the math come alive.
                    </p>
                </div>
            </div>

            <div className="home-topics">
                <div className="home-topics-header fade-in-up">
                    <h2 className="home-topics-title">Explore Topics</h2>
                    <p className="home-topics-subtitle">
                        Choose a topic to dive into interactive 3D visualizations
                    </p>
                </div>

                <div className="topics-grid">
                    {topics.map((topic, index) => (
                        <Link
                            key={topic.id}
                            to={`/${topic.id}`}
                            className={`topic-card fade-in-up stagger-${index + 1}`}
                            style={{ '--card-gradient': topic.gradient } as React.CSSProperties}
                        >
                            <div className="topic-card-icon" style={{ background: topic.gradient }}>
                                {topic.icon}
                            </div>
                            <h3 className="topic-card-title">{topic.title}</h3>
                            <p className="topic-card-description">
                                {getTopicDescription(topic.id)}
                            </p>
                            <div className="topic-card-footer">
                                <span className="topic-card-count">
                                    {topic.subtopics.length} visualization{topic.subtopics.length !== 1 ? 's' : ''}
                                </span>
                                <span className="topic-card-arrow">→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}

function getTopicDescription(topicId: string): string {
    const descriptions: Record<string, string> = {
        'linear-algebra':
            'Vectors, matrices, transformations, and eigenvalues visualized in 3D space.',
        calculus:
            'Derivatives, integrals, and optimization brought to life with interactive surfaces.',
        probability:
            'Distributions, Bayes\' theorem, and Monte Carlo simulations in three dimensions.',
        ml:
            'Neural networks, decision boundaries, and gradient descent visualized interactively.',
    };
    return descriptions[topicId] ?? '';
}
