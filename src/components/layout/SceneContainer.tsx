import React, { useMemo, useState, useId } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import LessonGuide from '../LessonGuide';
import GraphicsQualityControl from '../GraphicsQualityControl';
import { getLessonGuide } from '../../data/lessonGuides';
import LessonConnections from '../LessonConnections';
import { getPathNavigation, hasLessonConnections } from '../../data/mlCurriculum';
import { BookOpen, ChevronLeft, Menu, SlidersHorizontal, X } from 'lucide-react';

interface SceneContainerProps {
    children: React.ReactNode;
    controls?: React.ReactNode;
    explanation?: React.ReactNode;
    defaultPanel?: 'controls' | 'explanation' | 'closed';
    onBack?: () => void; // Optional override, defaults to Link
    backUrl?: string;    // Defaults to '/topicId'
}

export function SceneContainer({
    children,
    controls,
    explanation,
    defaultPanel = 'controls',
    backUrl
}: SceneContainerProps) {
    const panelId = useId();
    const { topicId, subtopicId } = useParams<{ topicId: string; subtopicId: string }>();
    const [searchParams] = useSearchParams();
    const guide = topicId && subtopicId ? getLessonGuide(topicId, subtopicId) : undefined;
    const hasConnections = Boolean(topicId && subtopicId && hasLessonConnections(topicId, subtopicId));
    const isFollowingPath = Boolean(topicId && subtopicId && getPathNavigation(searchParams.get('path'), { topicId, subtopicId }));
    const tabs = useMemo(() => {
        const availableTabs: Array<{
            id: 'controls' | 'explanation' | 'learning' | 'guide';
            label: string;
            icon: React.ReactNode;
            content: React.ReactNode;
        }> = [];

        if (guide) {
            availableTabs.push({ id: 'guide', label: 'Guide', icon: <BookOpen size={15} />,
                content: <><LessonGuide guide={guide} /><GraphicsQualityControl /></>,
            });
        }
        if (controls) {
            availableTabs.push({
                id: 'controls',
                label: 'Controls',
                icon: <SlidersHorizontal size={15} />,
                content: controls,
            });
        }

        if (explanation) {
            availableTabs.push({
                id: 'explanation',
                label: 'Explain',
                icon: <BookOpen size={15} />,
                content: explanation,
            });
        }

        if (hasConnections) {
            availableTabs.push({
                id: 'learning',
                label: 'Learn',
                icon: <BookOpen size={15} />,
                content: <LessonConnections />,
            });
        }
        return availableTabs;
    }, [controls, explanation, hasConnections, guide]);

    const firstTab = tabs[0]?.id ?? 'controls';
    const requestedPanel = isFollowingPath ? 'learning' : defaultPanel === 'closed' ? firstTab : defaultPanel;
    const initialPanel = tabs.some((tab) => tab.id === requestedPanel) ? requestedPanel : firstTab;
    const [isPanelOpen, setIsPanelOpen] = useState((isFollowingPath || defaultPanel !== 'closed') && tabs.length > 0);
    const [activePanel, setActivePanel] = useState<'controls' | 'explanation' | 'learning' | 'guide'>(initialPanel);
    const activeTab = tabs.find((tab) => tab.id === activePanel) ?? tabs[0];
    const hasScenePanel = tabs.length > 0;

    return (
        <div className={`scene-shell ${isPanelOpen ? 'scene-panel-is-open' : ''}`}>
            {/* 1. Global Navigation Overlay (Top Left) */}
            <nav className="scene-nav" aria-label="Scene navigation">
                {backUrl && (
                    <Link
                        to={backUrl}
                        className="scene-icon-button"
                        aria-label="Back"
                    >
                        <ChevronLeft size={20} />
                    </Link>
                )}

                {/* Title Breadcrumb - Only visible on larger screens or if space permits? 
            For now, let's keep it minimal to focus on the scene. 
            Actually, let's show it. 
        */}
                {/* 
        <div style={{
           pointerEvents: 'auto',
           background: 'rgba(15, 23, 42, 0.8)',
           backdropFilter: 'blur(8px)',
           border: '1px solid rgba(148, 163, 184, 0.1)',
           borderRadius: '12px',
           padding: '8px 16px',
           color: 'white'
        }}>
           <h1 style={{fontSize: '14px', fontWeight: 600}}>{title}</h1>
        </div>
        */}
            </nav>

            {/* 2. Main Content (Canvas) */}
            <div className="scene-main">
                {children}
            </div>

            {/* 3. Scene Drawer (Top Right / Right Slide-in) */}
            {hasScenePanel && (
                <div className="scene-panel-region">
                    <button
                        type="button"
                        onClick={() => setIsPanelOpen((isOpen) => !isOpen)}
                        className={`scene-icon-button scene-panel-toggle ${isPanelOpen ? 'active' : ''}`}
                        aria-label={isPanelOpen ? 'Close scene panel' : 'Open scene panel'}
                        aria-expanded={isPanelOpen}
                        aria-controls={panelId}
                    >
                        {isPanelOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    {isPanelOpen && activeTab && (
                        <aside
                            id={panelId}
                            className="scene-panel-drawer"
                            aria-label="Scene panel"
                        >
                            {tabs.length > 1 && (
                                <div className="scene-panel-tabs" style={{ gridTemplateColumns: `repeat(${tabs.length > 3 ? 2 : tabs.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Scene panel sections">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            id={`${panelId}-${tab.id}`}
                                            aria-controls={`${panelId}-content`}
                                            tabIndex={activeTab.id === tab.id ? 0 : -1}
                                            onKeyDown={event => {
                                                const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
                                                if (!keys.includes(event.key)) return;
                                                event.preventDefault();
                                                const current = tabs.findIndex(item => item.id === tab.id);
                                                const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                                                    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                                                setActivePanel(tabs[index].id);
                                                document.getElementById(`${panelId}-${tabs[index].id}`)?.focus();
                                            }}
                                            aria-selected={activeTab.id === tab.id}
                                            className={`scene-panel-tab ${activeTab.id === tab.id ? 'active' : ''}`}
                                            onClick={() => setActivePanel(tab.id)}
                                        >
                                            {tab.icon}
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="scene-panel-content"
                                id={`${panelId}-content`}
                                role={tabs.length > 1 ? 'tabpanel' : undefined}
                                aria-labelledby={tabs.length > 1 ? `${panelId}-${activeTab.id}` : undefined}
                                tabIndex={tabs.length > 1 ? 0 : undefined}
                            >
                                {activeTab.id === 'controls' && guide && <div className="scene-quick-guide">
                                    <p>{guide.meaning}</p>
                                    <p><strong>Start here:</strong> {guide.steps[0]}</p>
                                    <button type="button" onClick={() => setActivePanel('guide')}>Read the guide →</button>
                                </div>}
                                {activeTab.content}
                            </div>
                        </aside>
                    )}
                </div>
            )}
        </div>
    );
}
