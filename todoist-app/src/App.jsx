import { useEffect } from 'react';
import { useStore } from './store/store.js';
import { useHashRoute, navigate } from './lib/router.js';
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

  // Global shortcuts: q = quick add, t = today, u = upcoming (ignored while typing).
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === 'q') {
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
    <div className="app">
      <Sidebar />
      <main className="main" key={`${route.name}:${route.param || ''}`}>
        <View route={route} />
      </main>
      <QuickAdd />
      <TaskDetail />
      <LevelUpOverlay />
      <Toasts />
    </div>
  );
}
