import { Fragment, useEffect, useRef, type RefObject } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { topics } from '../data/topics';
import { X } from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

export default function Sidebar({ isOpen, onClose, returnFocusRef }: SidebarProps) {
    const isMobile = useIsMobile();
    const location = useLocation();
    const selectedSection = new URLSearchParams(location.search).get('section');
    const sidebarRef = useRef<HTMLElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!isMobile || !isOpen) return;
        const previousFocus = returnFocusRef?.current ?? document.activeElement;
        closeRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
            if (event.key !== 'Tab') return;
            const items = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
            if (!items?.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, [isMobile, isOpen, onClose, returnFocusRef]);

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="sidebar-overlay"
                    aria-hidden="true"
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 99,
                        backdropFilter: 'blur(2px)'
                    }}
                />
            )}

            <aside
                ref={sidebarRef}
                id="topic-navigation"
                className={`sidebar ${isOpen ? 'open' : ''}`}
                inert={isMobile && !isOpen}
                aria-hidden={isMobile && !isOpen ? true : undefined}
                role={isMobile && isOpen ? 'dialog' : undefined}
                aria-modal={isMobile && isOpen ? true : undefined}
                aria-label="Topic navigation"
            >
                <div className="sidebar-header">
                    <NavLink to="/" className="sidebar-logo" onClick={onClose}>
                        <div className="sidebar-logo-icon">M³</div>
                        <div className="sidebar-logo-text">
                            <span className="sidebar-logo-title">Math3D</span>
                            <span className="sidebar-logo-subtitle">Visual Learning</span>
                        </div>
                    </NavLink>

                    {/* Close button for mobile */}
                    <button
                        ref={closeRef}
                        type="button"
                        className="sidebar-close-btn"
                        onClick={onClose}
                        aria-label="Close sidebar"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            marginLeft: 'auto'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="sidebar-nav" aria-label="Mathematics topics">
                    <NavLink
                        to="/"
                        end
                        onClick={onClose}
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? 'active' : ''}`
                        }
                        style={{ '--item-color': '#a29bfe' } as React.CSSProperties}
                    >
                        <span className="sidebar-nav-icon">🏠</span>
                        <span className="sidebar-nav-label">Home</span>
                    </NavLink>

                    {topics.map((topic) => (
                        <Fragment key={topic.id}>
                        <NavLink
                            key={topic.id}
                            to={`/${topic.id}`}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `sidebar-nav-item ${isActive ? 'active' : ''}`
                            }
                            style={{ '--item-color': topic.color } as React.CSSProperties}
                        >
                            <span className="sidebar-nav-icon">{topic.icon}</span>
                            <span className="sidebar-nav-label">{topic.title}</span>
                            <span className="sidebar-nav-count">{topic.subtopics.length}</span>
                        </NavLink>
                        {topic.id === 'ml' && (
                            <div className="sidebar-learning-links" aria-label="Machine learning sections">
                                {[
                                    { id: 'algorithms', label: 'Algorithms' },
                                    { id: 'concepts', label: 'Core Concepts' },
                                ].map(section => {
                                    const active = location.pathname === '/ml' && selectedSection === section.id;
                                    return <Link key={section.id} to={`/ml?section=${section.id}`} onClick={onClose}
                                        className={`sidebar-learning-link ${active ? 'active' : ''}`}
                                        aria-current={active ? 'page' : undefined}
                                    >{section.label}</Link>;
                                })}
                            </div>
                        )}
                        </Fragment>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <p className="sidebar-footer-text">
                        Interactive 3D Mathematics
                    </p>
                </div>
            </aside>
        </>
    );
}
