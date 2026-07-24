import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../store/store.js';
import { activeChildrenOf } from '../store/selectors.js';
import TaskItem from './TaskItem.jsx';
import { PlusIcon } from './icons.jsx';

function SortableRow({ task, showProject, renderChildren }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'sortable-dragging' : ''}
    >
      <TaskItem task={task} showProject={showProject} dragHandleProps={{ ...attributes, ...listeners }}>
        {renderChildren ? renderChildren(task) : null}
      </TaskItem>
    </div>
  );
}

// Nested (non-draggable) subtask tree, project views only.
function SubtaskTree({ tasksMap, parent, depth }) {
  const kids = activeChildrenOf(tasksMap, parent.id);
  if (!kids.length || depth > 3) return null;
  return kids.map((kid) => (
    <TaskItem key={kid.id} task={kid} depth={depth}>
      <SubtaskTree tasksMap={tasksMap} parent={kid} depth={depth + 1} />
    </TaskItem>
  ));
}

export function AddTaskButton({ context, label = 'Add task' }) {
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen);
  return (
    <button type="button" className="add-task-btn" onClick={() => setQuickAddOpen(context || {})}>
      <PlusIcon size={14} />
      <span>{label}</span>
    </button>
  );
}

/**
 * tasks: top-level rows to render, already sorted.
 * sortable: register rows in a SortableContext (a DndContext must wrap the view).
 * nested: render active subtask trees under each row (project views).
 * addContext: when set, shows an "+ Add task" row opening QuickAdd with these defaults.
 */
export default function TaskList({ tasks, sortable = false, nested = false, showProject = false, addContext = null }) {
  const tasksMap = useStore((s) => s.tasks);
  const renderChildren = nested
    ? (task) => <SubtaskTree tasksMap={tasksMap} parent={task} depth={1} />
    : null;

  const rows = sortable ? (
    <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      {tasks.map((task) => (
        <SortableRow key={task.id} task={task} showProject={showProject} renderChildren={renderChildren} />
      ))}
    </SortableContext>
  ) : (
    tasks.map((task) => (
      <TaskItem key={task.id} task={task} showProject={showProject}>
        {renderChildren ? renderChildren(task) : null}
      </TaskItem>
    ))
  );

  return (
    <div className="task-list">
      {rows}
      {addContext ? <AddTaskButton context={addContext} /> : null}
    </div>
  );
}
