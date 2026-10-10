import { useState, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useIsMobile } from './hooks/useIsMobile';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import TopicPage from './components/TopicPage';
import SubtopicView from './components/SubtopicView';
import NotFound from './components/NotFound';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isMobile = useIsMobile();
  const navigationButtonRef = useRef<HTMLButtonElement>(null);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
          returnFocusRef={navigationButtonRef}
        />

        <main className="main-content" inert={isMobile && isSidebarOpen}>
          {/* Mobile Sidebar Toggle */}
          <button
            ref={navigationButtonRef}
            className="mobile-sidebar-toggle"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
            aria-expanded={isSidebarOpen}
            aria-controls="topic-navigation"
          >
            <Menu size={24} />
          </button>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/:topicId" element={<TopicPage />} />
            <Route path="/:topicId/:subtopicId" element={<SubtopicView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
