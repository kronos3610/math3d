import { Suspense, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTopicById, getSubtopicById } from '../data/topics';
import { getLessonGuide } from '../data/lessonGuides';
import LessonGuide from './LessonGuide';
import SceneErrorBoundary from './SceneErrorBoundary';
import GraphicsQualityControl from './GraphicsQualityControl';

interface SceneStatusProps { topicId: string; subtopicId: string; failed?: boolean; color?: string; }

function SceneStatus({ topicId, subtopicId, failed = false, color = '#6c5ce7' }: SceneStatusProps) {
    const [takingLong, setTakingLong] = useState(false);
    useEffect(() => {
        if (failed) return;
        const timer = window.setTimeout(() => setTakingLong(true), 8000);
        return () => window.clearTimeout(timer);
    }, [failed]);
    const subtopic = getSubtopicById(topicId, subtopicId);
    const guide = getLessonGuide(topicId, subtopicId);
    return <div className="scene-status-page">
        <Link to={`/${topicId}`} className="scene-status-back"><span aria-hidden="true">← </span>Back to topic</Link>
        <h1>{subtopic?.title}</h1>
        <div role="status" className="scene-status-message">
            {!failed && <div className="loading-spinner" style={{ borderTopColor: color }} />}
            <p>{failed ? 'This visualization could not start.' : takingLong ? 'This visualization is taking longer than expected.' : 'Loading visualization…'}</p>
        </div>
        {(failed || takingLong) && <div className="scene-status-recovery">
            <p>You can read the guide below while the scene is unavailable, or reload it and try again.</p>
            <button type="button" className="lab-button" onClick={() => window.location.reload()}>Reload visualization</button>
            <GraphicsQualityControl />
        </div>}
        {guide && <LessonGuide guide={guide} />}
    </div>;
}

export default function SubtopicView() {
    const { topicId, subtopicId } = useParams<{ topicId: string; subtopicId: string }>();
    const topic = topicId ? getTopicById(topicId) : undefined;
    const subtopic = topicId && subtopicId ? getSubtopicById(topicId, subtopicId) : undefined;
    if (!topic || !subtopic) {
        return <div className="topic-page">
            <h1 className="topic-page-title">Visualization Not Found</h1>
            <p className="topic-page-description">The requested visualization does not exist.</p>
            <Link to="/" className="subtopic-view-back" style={{ marginTop: 16 }}>← Back</Link>
        </div>;
    }
    const SceneComponent = subtopic.component;
    const reference = { topicId: topic.id, subtopicId: subtopic.id, color: topic.color };
    return <div className="subtopic-view" style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0 }}>
        <SceneErrorBoundary key={`${topic.id}/${subtopic.id}`} fallback={<SceneStatus {...reference} failed />}>
            <Suspense fallback={<SceneStatus {...reference} />}><SceneComponent /></Suspense>
        </SceneErrorBoundary>
    </div>;
}
