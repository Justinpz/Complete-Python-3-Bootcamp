import { useMemo } from 'react';
import { useStore } from '../store/store.js';
import { tasksWithLabel, sortedProjects } from '../store/selectors.js';
import TaskList from '../components/TaskList.jsx';
import { SectionTitle } from '../components/Panel.jsx';
import { navigate } from '../lib/router.js';

// Group a flat task list by project, in sidebar project order.
export function groupByProject(list, projectsMap) {
  const projects = sortedProjects(projectsMap);
  return projects
    .map((project) => ({ project, tasks: list.filter((t) => t.projectId === project.id) }))
    .filter((g) => g.tasks.length > 0);
}

export default function LabelView({ labelId }) {
  const label = useStore((s) => s.labels[labelId]);
  const tasks = useStore((s) => s.tasks);
  const projectsMap = useStore((s) => s.projects);

  const groups = useMemo(
    () => groupByProject(tasksWithLabel(tasks, labelId), projectsMap),
    [tasks, labelId, projectsMap],
  );

  if (!label) {
    return (
      <div className="view">
        <div className="empty-state">
          <div className="empty-title">LABEL NOT FOUND</div>
          <button type="button" className="mini-btn" onClick={() => navigate('project/inbox')}>
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <header className="view-head">
        <span className="dot dot-lg" style={{ background: label.color }} />
        <h1>@{label.name}</h1>
      </header>
      {groups.map(({ project, tasks: list }) => (
        <div className="block" key={project.id}>
          <SectionTitle>
            {project.name.toUpperCase()} <span className="count">{list.length}</span>
          </SectionTitle>
          <TaskList tasks={list} />
        </div>
      ))}
      {!groups.length && (
        <div className="empty-state">
          <div className="empty-title">NOTHING TAGGED</div>
          <div className="empty-sub">Add @{label.name} to a task and it will muster here.</div>
        </div>
      )}
    </div>
  );
}
