import type { Command } from "../../modals/CommandPalette";
import type { EditorMode } from "../../types/ui";

export interface CommandActions {
  newNote: () => void;
  newExcalidrawNote: () => void;
  newNotebookNote: () => void;
  newTodoNote: () => void;
  openTodayNote: () => void;
  newFolder: () => void;
  openExplorer: () => void;
  openSearch: () => void;
  openTags: () => void;
  openTodos: () => void;
  openQuickSwitcher: () => void;
  openGraph: () => void;
  openSettings: () => void;
  exportVault: () => void;
  cycleEditorMode: () => void;
  archiveNote?: () => void;
  archiveLabel?: string;
  deleteFolder?: () => void;
  openVaultSwitcher: () => void;
  openCommandPalette: () => void;
  editorMode: EditorMode;
  folderDeletable: boolean;
}

export function buildCommands(actions: CommandActions): Command[] {
  return [
    { id: "new-note", label: "新建笔记", run: actions.newNote },
    { id: "new-excalidraw", label: "新建 Excalidraw 笔记", run: actions.newExcalidrawNote },
    { id: "new-notebook", label: "新建 Notebook 笔记", run: actions.newNotebookNote },
    { id: "new-todo", label: "新建 Todo 笔记", run: actions.newTodoNote },
    { id: "daily-note", label: "打开今日笔记", run: actions.openTodayNote },
    { id: "new-folder", label: "新建文件夹", run: actions.newFolder },
    { id: "explorer", label: "打开文件浏览", run: actions.openExplorer },
    { id: "search", label: "打开搜索", run: actions.openSearch },
    { id: "tags", label: "打开标签", run: actions.openTags },
    { id: "todos", label: "打开待办", run: actions.openTodos },
    { id: "quick-open", label: "快速跳转笔记", run: actions.openQuickSwitcher },
    { id: "graph", label: "打开关系图谱", run: actions.openGraph },
    { id: "settings", label: "打开设置", run: actions.openSettings },
    { id: "export-vault", label: "导出笔记到仓库", run: actions.exportVault },
    {
      id: "editor-mode",
      label: `切换编辑器模式（当前：${actions.editorMode}）`,
      run: actions.cycleEditorMode,
    },
    ...(actions.archiveNote && actions.archiveLabel
      ? [{ id: "archive", label: actions.archiveLabel, run: actions.archiveNote }]
      : []),
    ...(actions.folderDeletable && actions.deleteFolder
      ? [{ id: "del-folder", label: "删除空文件夹", run: actions.deleteFolder }]
      : []),
    { id: "vault", label: "切换 Vault", run: actions.openVaultSwitcher },
    { id: "palette", label: "命令面板", run: actions.openCommandPalette },
  ];
}
