import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../store/store.js';
import { useHashRoute, navigate } from '../lib/router.js';
import { todayCount, sortedProjects, sortedLabels, sortedFilters, activeTasks } from '../store/selectors.js';
import { parseFilter } from '../lib/filterQuery.js';
import { xpProgress } from '../lib/xp.js';
import XPBar from './XPBar.jsx';
import {
  SunIcon,
  CalendarIcon,
  InboxIcon,
  ArchiveIcon,
  ChartIcon,
  ChevronIcon,
  PlusIcon,
  TagIcon,
  FunnelIcon,
  TrashIcon,
  PencilIcon,
} from './icons.jsx';

function NavItem({ active, onClick, icon, label, badge, color }) {
  return (
    <button type="button" className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {color ? <span className="dot" style={{ background: color }} /> : icon}
      <span className="nav-label">{label}</span>
      {badge != null && badge !== 0 ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}

function SortableProjectRow({ project, count, active, onNav }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);

  if (editing) {
    return (
      <div className="nav-row-edit">
        <input
          className="text-input text-input-mini"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim()) updateProject(project.id, { name: name.trim() });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setName(project.name);
              setEditing(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`nav-row ${isDragging ? 'sortable-dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <NavItem active={active} onClick={onNav} label={project.name} badge={count} color={project.color} />
      <span className="nav-row-actions">
        <button type="button" className="icon-btn" aria-label={`Rename ${project.name}`} onClick={() => setEditing(true)}>
          <PencilIcon size={12} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Delete ${project.name}`}
          onClick={() => {
            if (window.confirm(`Delete project "${project.name}" and all its tasks?`)) {
              deleteProject(project.id);
              navigate('project/inbox');
            }
          }}
        >
          <TrashIcon size={12} />
        </button>
      </span>
    </div>
  );
}

function Group({ title, icon, children, onAdd, addLabel, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);
  return (
    <div className="side-group">
      <div className="side-group-head">
        <button type="button" className="side-group-toggle" onClick={() => setOpen((v) => !v)}>
          <ChevronIcon size={12} open={open} />
          {icon}
          <span>{title}</span>
        </button>
        {onAdd ? (
          <button type="button" className="icon-btn" aria-label={addLabel} onClick={() => setAdding(true)}>
            <PlusIcon size={13} />
          </button>
        ) : null}
      </div>
      {open ? children : null}
      {open && adding ? onAdd(() => setAdding(false)) : null}
    </div>
  );
}

function FilterForm({ onClose, initial }) {
  const addFilter = useStore((s) => s.addFilter);
  const updateFilter = useStore((s) => s.updateFilter);
  const [name, setName] = useState(initial?.name || '');
  const [query, setQuery] = useState(initial?.query || '');
  const parsed = useMemo(() => (query.trim() ? parseFilter(query) : null), [query]);
  const valid = Boolean(name.trim() && parsed?.ok);

  const submit = () => {
    if (!valid) return;
    if (initial) updateFilter(initial.id, { name: name.trim(), query: query.trim() });
    else addFilter(name, query);
    onClose();
  };

  return (
    <div className="side-form">
      <input
        className="text-input text-input-mini"
        placeholder="Filter name"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={`text-input text-input-mini ${parsed && !parsed.ok ? 'input-error' : ''}`}
        placeholder="p1 & today"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onClose();
        }}
      />
      {parsed && !parsed.ok ? <div className="side-form-error">{parsed.error.message}</div> : null}
      <div className="side-form-actions">
        <button type="button" className="mini-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="mini-btn mini-btn-primary" disabled={!valid} onClick={submit}>
          Save
        </button>
      </div>
    </div>
  );
}

function NameForm({ placeholder, onSubmit, onClose }) {
  const [name, setName] = useState('');
  return (
    <div className="side-form">
      <input
        className="text-input text-input-mini"
        placeholder={placeholder}
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onBlur={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) {
            onSubmit(name.trim());
            onClose();
          }
          if (e.key === 'Escape') onClose();
        }}
      />
    </div>
  );
}

export default function Sidebar() {
  const route = useHashRoute();
  const tasks = useStore((s) => s.tasks);
  const projectsMap = useStore((s) => s.projects);
  const labelsMap = useStore((s) => s.labels);
  const filtersMap = useStore((s) => s.filters);
  const game = useStore((s) => s.game);
  const addProject = useStore((s) => s.addProject);
  const addLabelAction = useStore((s) => s.addLabel);
  const deleteLabel = useStore((s) => s.deleteLabel);
  const deleteFilter = useStore((s) => s.deleteFilter);
  const reorderProject = useStore((s) => s.reorderProject);
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const projects = useMemo(() => sortedProjects(projectsMap), [projectsMap]);
  const labels = useMemo(() => sortedLabels(labelsMap), [labelsMap]);
  const filters = useMemo(() => sortedFilters(filtersMap), [filtersMap]);
  const counts = useMemo(() => {
    const map = {};
    for (const t of activeTasks(tasks)) map[t.projectId] = (map[t.projectId] || 0) + 1;
    return map;
  }, [tasks]);
  const nToday = useMemo(() => todayCount(tasks), [tasks]);
  const level = xpProgress(game.xp).level;
  const userProjects = projects.filter((p) => p.id !== 'inbox');
  const inbox = projectsMap.inbox;

  const onProjectDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = userProjects.map((p) => p.id);
    reorderProject(active.id, ids.indexOf(over.id));
  };

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="side-brand-name">
          LEVELED <span className="side-brand-sep">//</span> TASKS
        </div>
        <div className="side-brand-stats">
          <span className="side-level">Lv {level}</span>
          <span className="side-streak">🔥 {game.streak.current}</span>
        </div>
      </div>
      <XPBar xp={game.xp} compact />

      <button type="button" className="side-quickadd" onClick={() => setQuickAddOpen({})}>
        <PlusIcon size={15} />
        <span>ADD TASK</span>
        <kbd>Q</kbd>
      </button>

      <nav className="side-nav">
        <NavItem
          active={route.name === 'today'}
          onClick={() => navigate('today')}
          icon={<SunIcon size={15} />}
          label="Today"
          badge={nToday}
        />
        <NavItem
          active={route.name === 'upcoming'}
          onClick={() => navigate('upcoming')}
          icon={<CalendarIcon size={15} />}
          label="Upcoming"
        />
        <NavItem
          active={route.name === 'project' && route.param === 'inbox'}
          onClick={() => navigate('project/inbox')}
          icon={<InboxIcon size={15} />}
          label="Inbox"
          badge={counts.inbox}
        />
      </nav>

      <Group
        title="PROJECTS"
        onAdd={(close) => <NameForm placeholder="Project name" onSubmit={(n) => addProject(n)} onClose={close} />}
        addLabel="Add project"
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onProjectDragEnd}>
          <SortableContext items={userProjects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {userProjects.map((p) => (
              <SortableProjectRow
                key={p.id}
                project={p}
                count={counts[p.id]}
                active={route.name === 'project' && route.param === p.id}
                onNav={() => navigate(`project/${p.id}`)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {!userProjects.length && inbox ? <div className="side-empty">No projects yet.</div> : null}
      </Group>

      <Group
        title="LABELS"
        icon={<TagIcon size={12} />}
        onAdd={(close) => <NameForm placeholder="label-name" onSubmit={(n) => addLabelAction(n)} onClose={close} />}
        addLabel="Add label"
      >
        {labels.map((l) => (
          <div key={l.id} className="nav-row">
            <NavItem
              active={route.name === 'label' && route.param === l.id}
              onClick={() => navigate(`label/${l.id}`)}
              label={`@${l.name}`}
              color={l.color}
            />
            <span className="nav-row-actions">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete label ${l.name}`}
                onClick={() => {
                  if (window.confirm(`Delete label @${l.name}?`)) deleteLabel(l.id);
                }}
              >
                <TrashIcon size={12} />
              </button>
            </span>
          </div>
        ))}
      </Group>

      <Group
        title="FILTERS"
        icon={<FunnelIcon size={12} />}
        onAdd={(close) => <FilterForm onClose={close} />}
        addLabel="Add filter"
      >
        {filters.map((f) => (
          <div key={f.id} className="nav-row">
            <NavItem
              active={route.name === 'filter' && route.param === f.id}
              onClick={() => navigate(`filter/${f.id}`)}
              icon={<FunnelIcon size={13} />}
              label={f.name}
            />
            <span className="nav-row-actions">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete filter ${f.name}`}
                onClick={() => {
                  if (window.confirm(`Delete filter "${f.name}"?`)) deleteFilter(f.id);
                }}
              >
                <TrashIcon size={12} />
              </button>
            </span>
          </div>
        ))}
      </Group>

      <div className="side-bottom">
        <NavItem
          active={route.name === 'completed'}
          onClick={() => navigate('completed')}
          icon={<ArchiveIcon size={15} />}
          label="Completed"
        />
        <NavItem
          active={route.name === 'stats'}
          onClick={() => navigate('stats')}
          icon={<ChartIcon size={15} />}
          label="Stats"
        />
      </div>
    </aside>
  );
}
