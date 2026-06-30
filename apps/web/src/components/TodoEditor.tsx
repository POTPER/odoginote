import { useCallback, useMemo, useState } from "react";
import {
  parseTodoContent,
  serializeTodoContent,
  type TodoGroup,
  type TodoItem,
  type TodoList,
  type TodoPriority,
} from "@odoginote/shared";

interface Props {
  content: string;
  onChange: (json: string) => void;
}

function newId(): string {
  return crypto.randomUUID();
}

function createItem(): TodoItem {
  return { id: newId(), text: "", done: false };
}

function createGroup(title = "新分组"): TodoGroup {
  return { id: newId(), title, items: [createItem()] };
}

const PRIORITY_OPTIONS: { value: "" | TodoPriority; label: string }[] = [
  { value: "", label: "无" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

export default function TodoEditor({ content, onChange }: Props) {
  const list = useMemo(() => parseTodoContent(content), [content]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const updateList = useCallback(
    (next: TodoList) => {
      onChange(serializeTodoContent(next));
    },
    [onChange]
  );

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<TodoGroup>) => {
      updateList({
        ...list,
        groups: list.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
      });
    },
    [list, updateList]
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      if (list.groups.length <= 1) return;
      updateList({ ...list, groups: list.groups.filter((g) => g.id !== groupId) });
    },
    [list, updateList]
  );

  const updateItem = useCallback(
    (groupId: string, itemId: string, patch: Partial<TodoItem>) => {
      updateList({
        ...list,
        groups: list.groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            items: g.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
          };
        }),
      });
    },
    [list, updateList]
  );

  const addItem = useCallback(
    (groupId: string) => {
      updateList({
        ...list,
        groups: list.groups.map((g) =>
          g.id === groupId ? { ...g, items: [...g.items, createItem()] } : g
        ),
      });
    },
    [list, updateList]
  );

  const removeItem = useCallback(
    (groupId: string, itemId: string) => {
      updateList({
        ...list,
        groups: list.groups.map((g) => {
          if (g.id !== groupId) return g;
          const items = g.items.filter((item) => item.id !== itemId);
          return { ...g, items: items.length > 0 ? items : [createItem()] };
        }),
      });
    },
    [list, updateList]
  );

  const addGroup = useCallback(() => {
    updateList({ ...list, groups: [...list.groups, createGroup()] });
  }, [list, updateList]);

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className="todo-editor">
      <div className="todo-editor-toolbar">
        <button type="button" className="todo-toolbar-btn" onClick={addGroup}>
          + 添加分组
        </button>
      </div>

      <div className="todo-groups">
        {list.groups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          const doneCount = group.items.filter((i) => i.done).length;
          return (
            <section key={group.id} className="todo-group">
              <header className="todo-group-header">
                <button
                  type="button"
                  className="todo-group-toggle"
                  onClick={() => toggleGroupCollapse(group.id)}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? "▸" : "▾"}
                </button>
                <input
                  className="todo-group-title"
                  value={group.title}
                  onChange={(e) => updateGroup(group.id, { title: e.target.value })}
                  placeholder="分组名称"
                />
                <span className="todo-group-count">
                  {doneCount}/{group.items.length}
                </span>
                {list.groups.length > 1 && (
                  <button
                    type="button"
                    className="todo-group-delete"
                    title="删除分组"
                    onClick={() => removeGroup(group.id)}
                  >
                    ×
                  </button>
                )}
              </header>

              {!collapsed && (
                <ul className="todo-items">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className={`todo-item${item.done ? " todo-item--done" : ""}${
                        !item.done && item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10)
                          ? " todo-item--overdue"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="todo-item-check"
                        checked={item.done}
                        onChange={(e) => updateItem(group.id, item.id, { done: e.target.checked })}
                      />
                      <input
                        type="text"
                        className="todo-item-text"
                        value={item.text}
                        placeholder="待办事项"
                        onChange={(e) => updateItem(group.id, item.id, { text: e.target.value })}
                      />
                      <input
                        type="date"
                        className="todo-item-date"
                        value={item.dueDate ?? ""}
                        onChange={(e) =>
                          updateItem(group.id, item.id, {
                            dueDate: e.target.value || undefined,
                          })
                        }
                      />
                      <select
                        className={`todo-item-priority${item.priority ? ` todo-priority-${item.priority}` : ""}`}
                        value={item.priority ?? ""}
                        onChange={(e) =>
                          updateItem(group.id, item.id, {
                            priority: (e.target.value as TodoPriority) || undefined,
                          })
                        }
                      >
                        {PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value || "none"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="todo-item-delete"
                        title="删除"
                        onClick={() => removeItem(group.id, item.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  <li className="todo-item todo-item-add">
                    <button type="button" className="todo-add-item-btn" onClick={() => addItem(group.id)}>
                      + 添加待办
                    </button>
                  </li>
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
