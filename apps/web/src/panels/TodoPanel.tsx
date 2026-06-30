import { useMemo, useState } from "react";
import {
  PRIORITY_ORDER,
  aggregateTodoItems,
  type AggregatedTodoItem,
  type NoteSummary,
} from "@odoginote/shared";

type FilterTab = "all" | "pending" | "done" | "overdue";

interface Props {
  notes: NoteSummary[];
  onOpenNote: (number: number, title: string) => void;
  onToggleItem: (noteNumber: number, groupId: string, itemId: string, done: boolean) => Promise<void>;
  onNewTodoNote: () => void;
  newNoteDisabled?: boolean;
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "pending", label: "待办" },
  { id: "done", label: "已完成" },
  { id: "overdue", label: "已过期" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sortItems(items: AggregatedTodoItem[]): AggregatedTodoItem[] {
  return [...items].sort((a, b) => {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3;
    const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3;
    if (pa !== pb) return pa - pb;

    const da = a.dueDate ?? "9999-12-31";
    const db = b.dueDate ?? "9999-12-31";
    if (da !== db) return da.localeCompare(db);

    return a.noteTitle.localeCompare(b.noteTitle) || a.text.localeCompare(b.text);
  });
}

function filterItems(items: AggregatedTodoItem[], tab: FilterTab, today: string): AggregatedTodoItem[] {
  switch (tab) {
    case "pending":
      return items.filter((i) => !i.done);
    case "done":
      return items.filter((i) => i.done);
    case "overdue":
      return items.filter((i) => !i.done && i.dueDate != null && i.dueDate < today);
    default:
      return items;
  }
}

export default function TodoPanel({
  notes,
  onOpenNote,
  onToggleItem,
  onNewTodoNote,
  newNoteDisabled,
}: Props) {
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [toggling, setToggling] = useState<string | null>(null);
  const today = todayIso();

  const allItems = useMemo(
    () => aggregateTodoItems(notes.filter((n) => n.type === "todo")),
    [notes]
  );

  const visibleItems = useMemo(
    () => sortItems(filterItems(allItems, filter, today)),
    [allItems, filter, today]
  );

  const counts = useMemo(() => {
    const pending = allItems.filter((i) => !i.done).length;
    const done = allItems.filter((i) => i.done).length;
    const overdue = allItems.filter((i) => !i.done && i.dueDate != null && i.dueDate < today).length;
    return { pending, done, overdue, total: allItems.length };
  }, [allItems, today]);

  async function handleToggle(item: AggregatedTodoItem) {
    const key = `${item.noteNumber}-${item.id}`;
    if (toggling === key) return;
    setToggling(key);
    try {
      await onToggleItem(item.noteNumber, item.groupId, item.id, !item.done);
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="todo-panel">
      <div className="panel-header todo-panel-header">
        <span>待办</span>
        <button
          type="button"
          className="todo-panel-new-btn"
          onClick={onNewTodoNote}
          disabled={newNoteDisabled}
          title="新建 Todo 笔记"
        >
          ☑+
        </button>
      </div>

      <div className="todo-filter-tabs" role="tablist">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`todo-filter-tab${filter === tab.id ? " active" : ""}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            {tab.id === "pending" && counts.pending > 0 && (
              <span className="todo-filter-badge">{counts.pending}</span>
            )}
            {tab.id === "overdue" && counts.overdue > 0 && (
              <span className="todo-filter-badge todo-filter-badge--overdue">{counts.overdue}</span>
            )}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <p className="panel-muted">
          {allItems.length === 0
            ? "暂无 Todo 笔记。点击 ☑+ 创建待办清单。"
            : "当前筛选下没有待办项。"}
        </p>
      ) : (
        <ul className="todo-panel-list">
          {visibleItems.map((item) => {
            const isOverdue = !item.done && item.dueDate != null && item.dueDate < today;
            const toggleKey = `${item.noteNumber}-${item.id}`;
            return (
              <li
                key={toggleKey}
                className={`todo-panel-item${item.done ? " todo-panel-item--done" : ""}${
                  isOverdue ? " todo-panel-item--overdue" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="todo-panel-check"
                  checked={item.done}
                  disabled={toggling === toggleKey}
                  onChange={() => void handleToggle(item)}
                />
                <div className="todo-panel-item-body">
                  <div className="todo-panel-item-row">
                    {item.priority && (
                      <span
                        className={`todo-priority-dot todo-priority-${item.priority}`}
                        title={`优先级：${item.priority}`}
                      />
                    )}
                    <span className={`todo-panel-item-text${item.done ? " done" : ""}`}>{item.text || "（无标题）"}</span>
                  </div>
                  <div className="todo-panel-item-meta">
                    {item.dueDate && (
                      <span className={`todo-panel-date${isOverdue ? " overdue" : ""}`}>{item.dueDate}</span>
                    )}
                    <button
                      type="button"
                      className="todo-panel-note-link"
                      onClick={() => onOpenNote(item.noteNumber, item.noteTitle)}
                    >
                      {item.noteTitle}
                    </button>
                    {item.groupTitle && (
                      <span className="todo-panel-group-label">{item.groupTitle}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
