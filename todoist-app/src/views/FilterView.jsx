import { useMemo, useState } from 'react';
import { useStore } from '../store/store.js';
import { runFilter, groupByProject } from '../store/selectors.js';
import { parseFilter } from '../lib/filterQuery.js';
import TaskList from '../components/TaskList.jsx';
import { SectionTitle, IconButton, SkewButton } from '../components/Panel.jsx';
import { PencilIcon, TrashIcon } from '../components/icons.jsx';
import { navigate } from '../lib/router.js';

function FilterEditor({ filter, onClose }) {
  const updateFilter = useStore((s) => s.updateFilter);
  const [name, setName] = useState(filter.name);
  const [query, setQuery] = useState(filter.query);
  const parsed = useMemo(() => parseFilter(query), [query]);

  return (
    <div className="filter-editor panel">
      <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Filter name" />
      <input
        className={`text-input ${!parsed.ok ? 'input-error' : ''}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter query"
      />
      {!parsed.ok ? (
        <div className="side-form-error">
          {parsed.error.message} (at position {parsed.error.position})
        </div>
      ) : null}
      <div className="side-form-actions">
        <button type="button" className="mini-btn" onClick={onClose}>
          Cancel
        </button>
        <SkewButton
          disabled={!parsed.ok || !name.trim()}
          onClick={() => {
            updateFilter(filter.id, { name: name.trim(), query: query.trim() });
            onClose();
          }}
        >
          SAVE
        </SkewButton>
      </div>
    </div>
  );
}

export default function FilterView({ filterId }) {
  const filter = useStore((s) => s.filters[filterId]);
  const tasks = useStore((s) => s.tasks);
  const labels = useStore((s) => s.labels);
  const projects = useStore((s) => s.projects);
  const deleteFilter = useStore((s) => s.deleteFilter);
  const [editing, setEditing] = useState(false);

  const result = useMemo(
    () => (filter ? runFilter({ tasks, labels, projects }, filter.query) : null),
    [filter, tasks, labels, projects],
  );

  if (!filter) {
    return (
      <div className="view">
        <div className="empty-state">
          <div className="empty-title">FILTER NOT FOUND</div>
          <button type="button" className="mini-btn" onClick={() => navigate('project/inbox')}>
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  const groups = result?.ok ? groupByProject(result.tasks, projects) : [];

  return (
    <div className="view">
      <header className="view-head">
        <h1>{filter.name}</h1>
        <code className="filter-query">{filter.query}</code>
        <span className="view-head-actions">
          <IconButton label="Edit filter" onClick={() => setEditing(true)}>
            <PencilIcon size={14} />
          </IconButton>
          <IconButton
            label="Delete filter"
            onClick={() => {
              if (window.confirm(`Delete filter "${filter.name}"?`)) {
                deleteFilter(filterId);
                navigate('project/inbox');
              }
            }}
          >
            <TrashIcon size={14} />
          </IconButton>
        </span>
      </header>

      {editing ? <FilterEditor filter={filter} onClose={() => setEditing(false)} /> : null}

      {result && !result.ok ? (
        <div className="empty-state">
          <div className="empty-title">BROKEN QUERY</div>
          <div className="empty-sub">
            {result.error.message} (at position {result.error.position})
          </div>
        </div>
      ) : (
        <>
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
              <div className="empty-title">NO MATCHES</div>
              <div className="empty-sub">No active tasks match “{filter.query}”.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
