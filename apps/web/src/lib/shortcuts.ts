export type ShortcutId =
  | "newNote"
  | "commandPalette"
  | "quickSwitcher"
  | "todayNote"
  | "search"
  | "save"
  | "closeTab"
  | "toggleEditorMode"
  | "explorer";

export interface ShortcutHint {
  id: ShortcutId;
  keys: string;
  label: string;
}

export const SHORTCUT_UNFOCUSED_HINT = "点击应用区域以启用快捷键";

export const SHORTCUT_HINTS: ShortcutHint[] = [
  { id: "newNote", keys: "Ctrl+Alt+N", label: "新建笔记" },
  { id: "commandPalette", keys: "Ctrl+P", label: "命令面板" },
  { id: "quickSwitcher", keys: "Ctrl+Alt+O", label: "快速跳转" },
  { id: "todayNote", keys: "Ctrl+Alt+T", label: "今日笔记" },
  { id: "search", keys: "Ctrl+Shift+F", label: "搜索" },
  { id: "save", keys: "Ctrl+S", label: "立即保存" },
  { id: "closeTab", keys: "Ctrl+Alt+W", label: "关闭标签" },
  { id: "toggleEditorMode", keys: "Ctrl+Alt+E", label: "切换编辑模式" },
  { id: "explorer", keys: "Ctrl+Shift+E", label: "文件浏览" },
];

interface ShortcutSpec {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

const SHORTCUT_SPECS: Record<ShortcutId, ShortcutSpec> = {
  newNote: { key: "n", ctrl: true, alt: true, shift: false },
  commandPalette: { key: "p", ctrl: true, alt: false, shift: false },
  quickSwitcher: { key: "o", ctrl: true, alt: true, shift: false },
  todayNote: { key: "t", ctrl: true, alt: true, shift: false },
  search: { key: "f", ctrl: true, alt: false, shift: true },
  save: { key: "s", ctrl: true, alt: false, shift: false },
  closeTab: { key: "w", ctrl: true, alt: true, shift: false },
  toggleEditorMode: { key: "e", ctrl: true, alt: true, shift: false },
  explorer: { key: "e", ctrl: true, alt: false, shift: true },
};

function hasMod(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

export function matchShortcut(e: KeyboardEvent, id: ShortcutId): boolean {
  const spec = SHORTCUT_SPECS[id];
  if (e.key.toLowerCase() !== spec.key) return false;
  if (hasMod(e) !== spec.ctrl) return false;
  if (e.altKey !== spec.alt) return false;
  if (e.shiftKey !== spec.shift) return false;
  return true;
}
