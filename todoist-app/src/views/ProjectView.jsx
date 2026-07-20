import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { useStore } from '../store/store.js';
import { tasksInGroup, sectionsOf } from '../store/selectors.js';
import TaskList from '../components/TaskList.jsx';
import { IconButton } from '../components/Panel.jsx';
import { ChevronIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/icons.jsx';
import { navigate } from '../lib/router.js';

function containerId(sectionId) {
  return `sec:${sectionId ?? 'none'}`;
}

function DroppableArea({ sectionId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId(sectionId), data: { type: 'container', sectionId } });
  return (
    <div ref={setNodeRef} className={`droppable ${isOver ? 'droppable-over' : ''}`}>
      {children}
    </div>
  );
}

function SectionBlock({ section, tasks, projectId }) {
  const updateSection = useStore((s) => s.updateSection);
  const deleteSection = useStore((s) => s.deleteSection);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);

  return (
    <div className="block section-block">
      <div className="section-head">
        <button
          type="button"
          className="section-toggle"
          onClick={() => updateSection(section.id, { collapsed: !section.collapsed })}
        >
          <ChevronIcon size={13} open={!section.collapsed} />
        </button>
        {editing ? (
          <input
            className="text-input text-input-mini"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim()) updateSection(section.id, { name: name.trim() });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setName(section.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h2 className="section-name">
            {section.name} <span className="count">{tasks.length}</span>
          </h2>
        )}
        <span className="section-actions">
          <IconButton label="Rename section" onClick={() => setEditing(true)}>
            <PencilIcon size={12} />
          </IconButton>
          <IconButton
            label="Delete section"
            onClick={() => {
              if (window.confirm(`Delete section "${section.name}"? Its tasks move out of the section.`)) {
                deleteSection(section.id);
              }
            }}
          >
            <TrashIcon size={12} />
          </IconButton>
        </span>
      </div>
      {!section.collapsed && (
        <DroppableArea sectionId={section.id}>
          <TaskList
            tasks={tasks}
            sortable
            nested
            addContext={{ projectId, sectionId: section.id }}
          />
        </DroppableArea>
      )}
    </div>
  );
}

export default function ProjectView({ projectId }) {
  const project = useStore((s) => s.projects[projectId]);
  const tasks = useStore((s) => s.tasks);
  const sectionsMap = useStore((s) => s.sections);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const addSection = useStore((s) => s.addSection);
  const moveTask = useStore((s) => s.moveTask);
  const reorderTask = useStore((s) => s.reorderTask);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(project?.name || '');
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const sections = useMemo(() => sectionsOf(sectionsMap, projectId), [sectionsMap, projectId]);
  const sectionless = useMemo(
    () => tasksInGroup(tasks, { projectId, sectionId: null, parentId: null }),
    [tasks, projectId],
  );
  const sectionTasks = useMemo(
    () =>
      Object.fromEntries(
        sections.map((sec) => [
          sec.id,
          tasksInGroup(tasks, { projectId, sectionId: sec.id, parentId: null }),
        ]),
      ),
    [tasks, sections, projectId],
  );

  if (!project) {
    return (
      <div className="view">
        <div className="empty-state">
          <div className="empty-title">PROJECT NOT FOUND</div>
          <button type="button" className="mini-btn" onClick={() => navigate('project/inbox')}>
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  const listFor = (sectionId) => (sectionId === null ? sectionless : sectionTasks[sectionId] || []);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const dragged = tasks[active.id];
    if (!dragged) return;
    if (over.data?.current?.type === 'container') {
      const sectionId = over.data.current.sectionId;
      if (dragged.sectionId === sectionId && dragged.parentId === null) return;
      moveTask(active.id, { projectId, sectionId, parentId: null });
      return;
    }
    const target = tasks[over.id];
    if (!target) return;
    const targetList = listFor(target.sectionId);
    const index = targetList.findIndex((t) => t.id === target.id);
    if (dragged.sectionId === target.sectionId && dragged.parentId === null) {
      reorderTask(active.id, index);
    } else {
      moveTask(active.id, { projectId, sectionId: target.sectionId, parentId: null }, index);
    }
  };

  return (
    <div className="view">
      <header className="view-head">
        <span className="dot dot-lg" style={{ background: project.color }} />
        {editingName && projectId !== 'inbox' ? (
          <input
            className="text-input view-head-edit"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim()) updateProject(projectId, { name: name.trim() });
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setName(project.name);
                setEditingName(false);
              }
            }}
          />
        ) : (
          <h1>{project.name}</h1>
        )}
        {projectId !== 'inbox' && (
          <span className="view-head-actions">
            <IconButton
              label="Rename project"
              onClick={() => {
                setName(project.name);
                setEditingName(true);
              }}
            >
              <PencilIcon size={14} />
            </IconButton>
            <IconButton
              label="Delete project"
              onClick={() => {
                if (window.confirm(`Delete project "${project.name}" and all its tasks?`)) {
                  deleteProject(projectId);
                  navigate('project/inbox');
                }
              }}
            >
              <TrashIcon size={14} />
            </IconButton>
          </span>
        )}
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="block">
          <DroppableArea sectionId={null}>
            <TaskList tasks={sectionless} sortable nested addContext={{ projectId, sectionId: null }} />
          </DroppableArea>
        </div>

        {sections.map((sec) => (
          <SectionBlock key={sec.id} section={sec} tasks={sectionTasks[sec.id] || []} projectId={projectId} />
        ))}
      </DndContext>

      {addingSection ? (
        <div className="side-form section-add-form">
          <input
            className="text-input text-input-mini"
            placeholder="Section name"
            value={sectionName}
            autoFocus
            onChange={(e) => setSectionName(e.target.value)}
            onBlur={() => setAddingSection(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sectionName.trim()) {
                addSection(projectId, sectionName.trim());
                setSectionName('');
                setAddingSection(false);
              }
              if (e.key === 'Escape') setAddingSection(false);
            }}
          />
        </div>
      ) : (
        <button type="button" className="add-section-btn" onClick={() => setAddingSection(true)}>
          <PlusIcon size={13} />
          <span>Add section</span>
        </button>
      )}
    </div>
  );
}
