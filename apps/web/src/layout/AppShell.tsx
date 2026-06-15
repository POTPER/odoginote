import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { EditorMode, FileTreeNode, NoteDetail, NoteSummary, SidebarPanel, UserInfo } from "@odoginote/shared";
import { buildFileTree, canDeleteFolder, todayIsoDate } from "@odoginote/shared";
import { api } from "../lib/api";
import { useSettings, useTabs } from "../hooks/useAppState";
import { useLayoutState } from "../hooks/useLayoutState";
import { useCommandPalette } from "../hooks/useCommandPalette";
import { useAppFocus } from "../hooks/useAppFocus";
import { useAppShortcuts } from "../hooks/useAppShortcuts";
import { SHORTCUT_HINTS, SHORTCUT_UNFOCUSED_HINT } from "../lib/shortcuts";
import LeftRibbon from "../layout/LeftRibbon";
import TabBar from "../layout/TabBar";
import StatusBar from "../layout/StatusBar";
import RightSidebar from "../layout/RightSidebar";
import PaneResizer from "../components/PaneResizer";
import FileExplorer from "../panels/FileExplorer";
import SearchPanel from "../panels/SearchPanel";
import GraphPanel from "../panels/GraphPanel";
import TagsPanel from "../panels/TagsPanel";
import SettingsPanel from "../panels/SettingsPanel";
import VaultSwitcher from "../modals/VaultSwitcher";
import CommandPalette from "../modals/CommandPalette";
import QuickSwitcher from "../modals/QuickSwitcher";
import NoteEditor, { type NoteEditorHandle } from "../components/NoteEditor";
import { useQuickSwitcher } from "../hooks/useQuickSwitcher";

interface Props {
  user: UserInfo;
  onUserUpdate: (user: UserInfo) => void;
}

export default function AppShell({ user, onUserUpdate }: Props) {
  const vaultKey = user.activeVault
    ? `${user.activeVault.owner}/${user.activeVault.repo}`
    : "none";

  const [panel, setPanel] = useState<SidebarPanel>("explorer");
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [folderList, setFolderList] = useState<string[]>([]);
  const [vaultNotes, setVaultNotes] = useState<NoteSummary[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteDetail | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [vaultSwitcherOpen, setVaultSwitcherOpen] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [editorStats, setEditorStats] = useState({ words: 0, line: 1, col: 1 });
  const creatingNoteRef = useRef(false);
  const editorRef = useRef<NoteEditorHandle>(null);
  const { settings, updateSettings } = useSettings();
  const { layout, updateLayout } = useLayoutState();
  const { tabs, activeNumber, setActiveNumber, openTab, closeTab, updateTabTitle, togglePin, reorderTabs } =
    useTabs(vaultKey);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const { open: qsOpen, setOpen: setQsOpen } = useQuickSwitcher();
  const { rootRef, isFocused, handleMouseDown } = useAppFocus();

  const loadTree = useCallback(async () => {
    const data = await api.getFolders();
    setFolderList(data.folders);
    setVaultNotes(data.notes);
    const visible = settings.showArchived
      ? data.notes
      : data.notes.filter((n) => n.state === "open");
    setTree(buildFileTree(data.folders, visible));
  }, [settings.showArchived]);

  useEffect(() => {
    loadTree();
  }, [loadTree, vaultKey]);

  useEffect(() => {
    if (activeNumber == null) {
      setCurrentNote(null);
      setEditorContent("");
      return;
    }
    api.getNote(activeNumber).then((note) => {
      setCurrentNote(note);
      setEditorContent(note.content);
    }).catch(console.error);
  }, [activeNumber, vaultKey]);

  const handleOpenNote = useCallback(
    (number: number, title: string) => {
      openTab({ number, title });
      setPanel("explorer");
    },
    [openTab]
  );

  const handleNewNote = useCallback(async () => {
    if (creatingNoteRef.current) return;
    creatingNoteRef.current = true;
    setCreatingNote(true);
    try {
      const note = await api.createNote({
        title: "Untitled",
        folder: activeFolder ?? "inbox",
        content: "",
      });
      await loadTree();
      handleOpenNote(note.number, note.title);
    } finally {
      creatingNoteRef.current = false;
      setCreatingNote(false);
    }
  }, [activeFolder, loadTree, handleOpenNote]);

  const handleNewFolder = useCallback(async () => {
    const name = prompt("文件夹名称（可用 / 表示层级，如 projects/docs）");
    if (!name?.trim()) return;
    const base = activeFolder ? `${activeFolder}/` : "";
    await api.createFolder(`${base}${name.trim()}`);
    await loadTree();
  }, [activeFolder, loadTree]);

  const handleDeleteFolder = useCallback(async () => {
    if (!activeFolder) return;
    if (!confirm(`删除空文件夹「${activeFolder}」？`)) return;
    try {
      await api.deleteFolder(activeFolder);
      setActiveFolder(null);
      await loadTree();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }, [activeFolder, loadTree]);

  const handleArchiveNote = useCallback(async () => {
    if (!currentNote) return;
    const newState = currentNote.state === "open" ? "closed" : "open";
    const updated = await api.updateNote(currentNote.number, { state: newState });
    setCurrentNote(updated);
    await loadTree();
  }, [currentNote, loadTree]);

  const handleOpenTodayNote = useCallback(async () => {
    const today = todayIsoDate();
    const existing = vaultNotes.find((n) => n.daily === today && n.state === "open");
    if (existing) {
      handleOpenNote(existing.number, existing.title);
      return;
    }
    if (creatingNoteRef.current) return;
    creatingNoteRef.current = true;
    setCreatingNote(true);
    try {
      const note = await api.createNote({
        title: today,
        folder: "daily",
        content: `# ${today}\n\n`,
        daily: today,
      });
      await loadTree();
      handleOpenNote(note.number, note.title);
    } finally {
      creatingNoteRef.current = false;
      setCreatingNote(false);
    }
  }, [vaultNotes, handleOpenNote, loadTree]);

  const handleExportVault = useCallback(async () => {
    setSaveStatus("导出中...");
    try {
      const res = await api.exportVault();
      setSaveStatus(
        `导出完成：${res.noteCount} 篇笔记，${res.mirroredAttachments} 张图片` +
          (res.skippedAttachments.length > 0
            ? `，跳过 ${res.skippedAttachments.length} 张外链`
            : "")
      );
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : "导出失败");
    }
  }, []);

  const cycleEditorMode = useCallback(() => {
    const order: EditorMode[] = ["split", "edit", "preview"];
    const idx = order.indexOf(settings.editorMode);
    updateSettings({ editorMode: order[(idx + 1) % order.length] });
  }, [settings.editorMode, updateSettings]);

  const handleCloseActiveTab = useCallback(() => {
    if (activeNumber != null) closeTab(activeNumber);
  }, [activeNumber, closeTab]);

  const handleCloseModals = useCallback(() => {
    setCmdOpen(false);
    setQsOpen(false);
  }, [setCmdOpen, setQsOpen]);

  useAppShortcuts({
    enabled: isFocused,
    modalOpen: cmdOpen || qsOpen,
    onToggleCommandPalette: () => setCmdOpen((v) => !v),
    onToggleQuickSwitcher: () => setQsOpen((v) => !v),
    onCloseModals: handleCloseModals,
    onNewNote: () => void handleNewNote(),
    onSave: () => void editorRef.current?.saveNow(),
    onCloseTab: handleCloseActiveTab,
    onToggleEditorMode: cycleEditorMode,
    onOpenSearch: () => setPanel("search"),
    onOpenExplorer: () => setPanel("explorer"),
    onOpenTodayNote: () => void handleOpenTodayNote(),
  });

  const handleNoteUpdate = useCallback(
    (updated: NoteDetail) => {
      setCurrentNote(updated);
      updateTabTitle(updated.number, updated.title);
      void loadTree();
    },
    [updateTabTitle, loadTree]
  );

  async function refreshUser() {
    const me = await api.getMe();
    onUserUpdate(me);
    await loadTree();
    setCurrentNote(null);
    setActiveNumber(null);
  }

  const folderDeletable =
    activeFolder != null && canDeleteFolder(activeFolder, folderList, vaultNotes);

  const allFolderOptions = useMemo(() => {
    const set = new Set([...folderList, ...vaultNotes.map((n) => n.folder || "inbox")]);
    return [...set].sort();
  }, [folderList, vaultNotes]);

  const commands = useMemo(
    () => [
      { id: "new-note", label: "新建笔记", run: () => void handleNewNote() },
      { id: "daily-note", label: "打开今日笔记", run: () => void handleOpenTodayNote() },
      { id: "new-folder", label: "新建文件夹", run: () => void handleNewFolder() },
      { id: "explorer", label: "打开文件浏览", run: () => setPanel("explorer") },
      { id: "search", label: "打开搜索", run: () => setPanel("search") },
      { id: "tags", label: "打开标签", run: () => setPanel("tags") },
      { id: "quick-open", label: "快速跳转笔记", run: () => setQsOpen(true) },
      { id: "graph", label: "打开关系图谱", run: () => setPanel("graph") },
      { id: "settings", label: "打开设置", run: () => setPanel("settings") },
      {
        id: "export-vault",
        label: "导出笔记到仓库",
        run: () => void handleExportVault(),
      },
      {
        id: "editor-mode",
        label: `切换编辑器模式（当前：${settings.editorMode}）`,
        run: cycleEditorMode,
      },
      ...(currentNote
        ? [
            {
              id: "archive",
              label: currentNote.state === "open" ? "归档当前笔记" : "恢复当前笔记",
              run: () => void handleArchiveNote(),
            },
          ]
        : []),
      ...(folderDeletable
        ? [{ id: "del-folder", label: "删除空文件夹", run: () => void handleDeleteFolder() }]
        : []),
      { id: "vault", label: "切换 Vault", run: () => setVaultSwitcherOpen(true) },
      { id: "palette", label: "命令面板", run: () => setCmdOpen(true) },
    ],
    [
      handleNewNote,
      handleOpenTodayNote,
      handleExportVault,
      handleNewFolder,
      handleArchiveNote,
      handleDeleteFolder,
      currentNote,
      folderDeletable,
      cycleEditorMode,
      settings.editorMode,
      setCmdOpen,
      setQsOpen,
    ]
  );

  const vaultLabel = user.activeVault
    ? `${user.activeVault.repo}`
    : "未选择 Vault";

  const showRightSidebar = settings.showOutline && currentNote != null;
  const sidebarWidth = layout.sidebarCollapsed ? 0 : layout.sidebarWidth;
  const rightWidth = layout.rightCollapsed ? 44 : layout.rightWidth;

  const shellStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
    "--outline-width": `${rightWidth}px`,
  } as CSSProperties;

  const handleNavigateFolder = useCallback(
    (folder: string) => {
      setPanel("explorer");
      setActiveFolder(folder);
    },
    []
  );

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onMouseDown={handleMouseDown}
      style={shellStyle}
      className={`app-shell${showRightSidebar ? " with-outline" : ""}${layout.sidebarCollapsed ? " sidebar-collapsed" : ""}${layout.rightCollapsed ? " right-collapsed" : ""}${isFocused ? " app-shell--focused" : " app-shell--unfocused"}`}
    >
      <LeftRibbon
        active={panel}
        onChange={setPanel}
        sidebarCollapsed={layout.sidebarCollapsed}
        onToggleSidebar={() => updateLayout({ sidebarCollapsed: !layout.sidebarCollapsed })}
      />

      {!layout.sidebarCollapsed && (
        <aside className="sidebar-panel">
          {panel === "explorer" && (
          <FileExplorer
            tree={tree}
            notes={vaultNotes}
            activeFolder={activeFolder}
            selectedNumber={activeNumber}
            onSelectFolder={setActiveFolder}
            onSelectNote={handleOpenNote}
            onNewNote={handleNewNote}
            onNewFolder={handleNewFolder}
            onDeleteFolder={handleDeleteFolder}
            canDeleteFolder={folderDeletable}
            newNoteDisabled={creatingNote}
          />
        )}
        {panel === "search" && <SearchPanel key={vaultKey} onOpenNote={handleOpenNote} />}
        {panel === "tags" && (
          <TagsPanel
            notes={vaultNotes.filter((n) => settings.showArchived || n.state === "open")}
            onOpenNote={handleOpenNote}
          />
        )}
        {panel === "graph" && <GraphPanel key={vaultKey} onOpenNote={handleOpenNote} />}
        {panel === "settings" && (
          <SettingsPanel
            user={user}
            editorMode={settings.editorMode}
            onEditorModeChange={(m) => updateSettings({ editorMode: m })}
            onVaultChange={() => void refreshUser()}
            onOpenVaultSwitcher={() => setVaultSwitcherOpen(true)}
            showArchived={settings.showArchived}
            onShowArchivedChange={(v) => updateSettings({ showArchived: v })}
            theme={settings.theme}
            onThemeChange={(t) => updateSettings({ theme: t })}
            showOutline={settings.showOutline}
            onShowOutlineChange={(v) => updateSettings({ showOutline: v })}
            imageStorage={settings.imageStorage}
            onImageStorageChange={(v) => updateSettings({ imageStorage: v })}
          />
        )}
          <PaneResizer
            onResize={(delta) =>
              updateLayout({ sidebarWidth: Math.min(480, Math.max(180, layout.sidebarWidth + delta)) })
            }
          />
        </aside>
      )}

      <main className="main-panel">
        <TabBar
          tabs={tabs}
          activeNumber={activeNumber}
          onSelect={setActiveNumber}
          onClose={closeTab}
          onNew={handleNewNote}
          onTogglePin={togglePin}
          onReorder={reorderTabs}
          newNoteDisabled={creatingNote}
        />
        <div className="editor-area">
          {currentNote ? (
            <NoteEditor
              ref={editorRef}
              key={currentNote.number}
              note={currentNote}
              editorMode={settings.editorMode}
              imageStorage={settings.imageStorage}
              folderOptions={allFolderOptions}
              allNotes={vaultNotes}
              vaultName={vaultLabel}
              onOpenNote={handleOpenNote}
              onUpdate={handleNoteUpdate}
              onSaveStatus={setSaveStatus}
              onContentChange={setEditorContent}
              onEditorModeChange={(m) => updateSettings({ editorMode: m })}
              onNavigateFolder={handleNavigateFolder}
              onEditorStats={setEditorStats}
              onNeedGitHubSession={() => setPanel("settings")}
            />
          ) : (
            <div className="empty-state">
              <p className="empty-title">GiNote</p>
              {!isFocused && <p className="empty-focus-hint">{SHORTCUT_UNFOCUSED_HINT}</p>}
              <ul className="empty-hints">
                {SHORTCUT_HINTS.map((hint) => (
                  <li key={hint.id}>
                    <kbd>{hint.keys}</kbd> {hint.label}
                  </li>
                ))}
                <li>从左侧选择笔记开始编辑</li>
              </ul>
            </div>
          )}
        </div>
      </main>

      {showRightSidebar && currentNote && (
        <RightSidebar
          panel={layout.rightPanel}
          onPanelChange={(p) => updateLayout({ rightPanel: p })}
          collapsed={layout.rightCollapsed}
          onToggleCollapse={() => updateLayout({ rightCollapsed: !layout.rightCollapsed })}
          content={editorContent}
          noteTitle={currentNote.title}
          noteNumber={currentNote.number}
          notes={vaultNotes}
          onJump={(line) => editorRef.current?.scrollToLine(line)}
          onOpenNote={handleOpenNote}
          onResize={(delta) =>
            updateLayout({ rightWidth: Math.min(400, Math.max(160, layout.rightWidth - delta)) })
          }
        />
      )}

      <StatusBar
        vaultLabel={vaultLabel}
        saveStatus={saveStatus}
        noteNumber={activeNumber}
        shortcutHint={!isFocused ? SHORTCUT_UNFOCUSED_HINT : undefined}
        wordCount={currentNote ? editorStats.words : undefined}
        cursorLine={currentNote ? editorStats.line : undefined}
        cursorCol={currentNote ? editorStats.col : undefined}
        onVaultClick={() => setVaultSwitcherOpen(true)}
      />

      <VaultSwitcher
        open={vaultSwitcherOpen}
        user={user}
        onClose={() => setVaultSwitcherOpen(false)}
        onSwitched={() => void refreshUser()}
      />

      <CommandPalette open={cmdOpen} commands={commands} onClose={() => setCmdOpen(false)} />

      <QuickSwitcher
        open={qsOpen}
        notes={vaultNotes.filter((n) => settings.showArchived || n.state === "open")}
        onOpen={handleOpenNote}
        onClose={() => setQsOpen(false)}
      />
    </div>
  );
}
