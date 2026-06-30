import type { NoteSummary } from "./types.js";

export type TodoPriority = "low" | "medium" | "high";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string;
  priority?: TodoPriority;
}

export interface TodoGroup {
  id: string;
  title: string;
  items: TodoItem[];
}

export interface TodoList {
  version: 1;
  groups: TodoGroup[];
}

export interface AggregatedTodoItem extends TodoItem {
  noteNumber: number;
  noteTitle: string;
  groupId: string;
  groupTitle: string;
}

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

function normalizePriority(raw: unknown): TodoPriority | undefined {
  if (typeof raw === "string" && PRIORITIES.includes(raw as TodoPriority)) {
    return raw as TodoPriority;
  }
  return undefined;
}

function normalizeItem(raw: Partial<TodoItem>): TodoItem | null {
  if (typeof raw.id !== "string" || typeof raw.text !== "string") return null;
  return {
    id: raw.id,
    text: raw.text,
    done: Boolean(raw.done),
    dueDate: typeof raw.dueDate === "string" && raw.dueDate ? raw.dueDate : undefined,
    priority: normalizePriority(raw.priority),
  };
}

function normalizeGroup(raw: Partial<TodoGroup>): TodoGroup | null {
  if (typeof raw.id !== "string" || typeof raw.title !== "string" || !Array.isArray(raw.items)) {
    return null;
  }
  const items = raw.items
    .map((item) => normalizeItem(item as Partial<TodoItem>))
    .filter((item): item is TodoItem => item != null);
  return { id: raw.id, title: raw.title, items };
}

export function createEmptyTodoList(): TodoList {
  return {
    version: 1,
    groups: [
      {
        id: "default",
        title: "待办",
        items: [],
      },
    ],
  };
}

export function parseTodoContent(raw: string): TodoList {
  const trimmed = raw.trim();
  if (!trimmed) return createEmptyTodoList();
  try {
    const parsed = JSON.parse(trimmed) as Partial<TodoList>;
    if (parsed.version !== 1 || !Array.isArray(parsed.groups)) {
      return createEmptyTodoList();
    }
    const groups = parsed.groups
      .map((g) => normalizeGroup(g as Partial<TodoGroup>))
      .filter((g): g is TodoGroup => g != null);
    return {
      version: 1,
      groups: groups.length > 0 ? groups : createEmptyTodoList().groups,
    };
  } catch {
    return createEmptyTodoList();
  }
}

export function serializeTodoContent(list: TodoList): string {
  return JSON.stringify(list, null, 2);
}

export function countTodoItems(content: string): { total: number; done: number } {
  const list = parseTodoContent(content);
  let total = 0;
  let done = 0;
  for (const group of list.groups) {
    for (const item of group.items) {
      total++;
      if (item.done) done++;
    }
  }
  return { total, done };
}

export function updateTodoItem(
  list: TodoList,
  groupId: string,
  itemId: string,
  patch: Partial<Pick<TodoItem, "text" | "done" | "dueDate" | "priority">>
): TodoList {
  return {
    ...list,
    groups: list.groups.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        items: group.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      };
    }),
  };
}

export function aggregateTodoItems(notes: NoteSummary[]): AggregatedTodoItem[] {
  const items: AggregatedTodoItem[] = [];
  for (const note of notes) {
    if (note.type !== "todo" || !note.content) continue;
    const list = parseTodoContent(note.content);
    for (const group of list.groups) {
      for (const item of group.items) {
        items.push({
          ...item,
          noteNumber: note.number,
          noteTitle: note.title,
          groupId: group.id,
          groupTitle: group.title,
        });
      }
    }
  }
  return items;
}

export const PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
