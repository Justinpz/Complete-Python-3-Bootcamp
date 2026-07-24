import { useEffect, useState } from 'react';
import { useStore } from './store/store.js';
import { useHashRoute, navigate } from './lib/router.js';
import { todayKey } from './lib/dates.js';
import { MenuIcon, XIcon } from './components/icons.jsx';
import Sidebar from './components/Sidebar.jsx';
import QuickAdd from './components/QuickAdd.jsx';
import TaskDetail from './components/TaskDetail.jsx';
import Toasts from './components/Toast.jsx';
import LevelUpOverlay from './components/LevelUpOverlay.jsx';
import TodayView from './views/TodayView.jsx';
import UpcomingView from './views/UpcomingView.jsx';
import ProjectView from './views/ProjectView.jsx';
import LabelView from './views/LabelView.jsx';
import FilterView from './views/FilterView.jsx';
import CompletedView from './views/CompletedView.jsx';
import StatsView from './views/StatsView.jsx';

function View({ route }) {
  switch (route.name) {
    case 'today':
      return <TodayView />;
    case 'upcoming':
      return <UpcomingView />;
    case 'label':
      return <LabelView labelId={route.param} />;
    case 'filter':
      return <FilterView filterId={route.param} />;
    case 'completed':
      return <CompletedView />;
    case 'stats':
      return <StatsView />;
    case 'project':
    default:
      return <ProjectView projectId={route.param || 'inbox'} />;
  }
}

export default function App() {
  const route = useHashRoute();
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen);
  const quickAddOpen = useStore((s) => s.quickAddOpen);
  const [day, setDay] = useState(todayKey);
  // Phone layout only: the sidebar is an off-canvas drawer (see theme.css).
  const [navOpen, setNavOpen] = useState(false);

  // Navigating or opening quick-add should dismiss the drawer.
  useEffect(() => {
    setNavOpen(false);
  }, [route.name, route.param, quickAddOpen]);

  // Re-render when the wall-clock day changes while the app stays open, so
  // Today/Upcoming and due chips do not go stale at midnight.
  useEffect(() => {
    const iv = setInterval(() => {
      const now = todayKey();
      if (now !== day) {
        useStore.getState().reconcileDay();
        setDay(now);
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [day]);

  // Global shortcuts: q = quick add, t = today, u = upcoming (ignored while typing).
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === 'Escape') {
        setNavOpen(false);
      } else if (e.key === 'q') {
        // With the detail modal open this would stack a hidden second modal
        if (useStore.getState().detailTaskId) return;
        e.preventDefault();
        setQuickAddOpen({});
      } else if (e.key === 't') {
        e.preventDefault();
        navigate('today');
      } else if (e.key === 'u') {
        e.preventDefault();
        navigate('upcoming');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setQuickAddOpen]);

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <button
        type="button"
        className="nav-toggle"
        aria-label={navOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={navOpen}
        onClick={() => setNavOpen((v) => !v)}
      >
        {navOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
      </button>
      <div className="nav-scrim" onClick={() => setNavOpen(false)} role="presentation" />
      <Sidebar />
      <main className="main" key={`${route.name}:${route.param || ''}:${day}`}>
        <View route={route} />
      </main>
      <QuickAdd />
      <TaskDetail />
      <LevelUpOverlay />
      <Toasts />
    </div>
  );
}
