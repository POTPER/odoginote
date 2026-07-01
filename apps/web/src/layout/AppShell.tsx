import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import type { UserInfo } from "@odoginote/shared";
import { api } from "../lib/api";
import { useSettings, useTabs } from "../hooks/useAppState";
import { useLayoutState } from "../hooks/useLayoutState";
import { useCommandPalette } from "../hooks/useCommandPalette";
import { useAppFocus } from "../hooks/useAppFocus";
import { useAppShortcuts } from "../hooks/useAppShortcuts";
import { SHORTCUT_HINTS, SHORTCUT_UNFOCUSED_HINT } from "../lib/shortcuts";
import type { EditorMode, SidebarPanel } from "../types/ui";
import VaultProvider from "../features/vault/VaultProvider";
import { useVault } from "../features/vault/useVault";
import { buildCommands } from "../features/commands/buildCommands";
import LeftRibbon from "../layout/LeftRibbon";
import TabBar from "../layout/TabBar";
import StatusBar from "../layout/StatusBar";
import RightSidebar from "../layout/RightSidebar";
import PaneResizer from "../components/PaneResizer";
import FileExplorer from "../panels/FileExplorer";
import SearchPanel from "../panels/SearchPanel";
import GraphPanel from "../panels/GraphPanel";
import TagsPanel from "../panels/TagsPanel";
import TodoPanel from "../panels/TodoPanel";
import SettingsModal from "../modals/SettingsModal";
import VaultSwitcher from "../modals/VaultSwitcher";
import CommandPalette from "../modals/CommandPalette";
import QuickSwitcher from "../modals/QuickSwitcher";
import NoteEditor, { type NoteEditorHandle } from "../components/NoteEditor";
import { useQuickSwitcher } from "../hooks/useQuickSwitcher";

interface Props {
  user: UserInfo;
  onUserUpdate: (user: UserInfo) => void;
}

interface InnerProps extends Props {
  panel: SidebarPanel;
  setPanel: (panel: SidebarPanel) => void;
}

function AppShellInner({ user, onUserUpdate, panel, setPanel }: InnerProps) {
  const vault = useVault();
  const [saveStatus, setSaveStatus] = useState("");
  const [vaultSwitcherOpen, setVaultSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorStats, setEditorStats] = useState({ words: 0, line: 1, col: 1 });
  const editorRef = useRef<NoteEditorHandle>(null);

  const { settings, updateSettings } = useSettings();
  const { layout, updateLayout } = useLayoutState();
  const { tabs, activeNumber, setActiveNumber, closeTab, togglePin, reorderTabs } = useTabs(
    vault.vaultKey
  );
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const { open: qsOpen, setOpen: setQsOpen } = useQuickSwitcher();
  const { rootRef, isFocused, handleMouseDown } = useAppFocus();

  const openSettings = useCallback(() => setSettingsOpen(true), []);

  const handleCloseModals = useCallback(() => {
    setCmdOpen(false);
    setQsOpen(false);
    setSettingsOpen(false);
    setVaultSwitcherOpen(false);
  }, [setCmdOpen, setQsOpen]);

  const cycleEditorMode = useCallback(() => {
    const order: EditorMode[] = ["split", "edit", "preview"];
    const idx = order.indexOf(settings.editorMode);
    updateSettings({ editorMode: order[(idx + 1) % order.length] });
  }, [settings.editorMode, updateSettings]);

  const handleCloseActiveTab = useCallback(() => {
    if (activeNumber != null) closeTab(activeNumber);
  }, [activeNumber, closeTab]);

  const handleExportVault = useCallback(async () => {
    setSaveStatus("导出中...");
    try {
      const msg = await vault.exportVault();
      setSaveStatus(msg);
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : "导出失败");
    }
  }, [vault]);

  useAppShortcuts({
    enabled: isFocused,
    modalOpen: cmdOpen || qsOpen || settingsOpen || vaultSwitcherOpen,
    onToggleCommandPalette: () => setCmdOpen((v) => !v),
    onToggleQuickSwitcher: () => setQsOpen((v) => !v),
    onCloseModals: handleCloseModals,
    onNewNote: () => void vault.newNote(),
    onSave: () => void editorRef.current?.saveNow(),
    onCloseTab: handleCloseActiveTab,
    onToggleEditorMode: cycleEditorMode,
    onOpenSearch: () => setPanel("search"),
    onOpenExplorer: () => setPanel("explorer"),
    onOpenTodayNote: () => void vault.openTodayNote(),
  });

  async function refreshUser() {
    const me = await api.getMe();
    onUserUpdate(me);
    await vault.loadTree();
    vault.resetVaultSession();
  }

  const handleNavigateFolder = useCallback(
    (folder: string) => {
      setPanel("explorer");
      vault.setActiveFolder(folder);
    },
    [vault, setPanel]
  );

  const handlePanelChange = useCallback(
    (id: SidebarPanel) => {
      if (id === "settings") {
        openSettings();
        return;
      }
      setPanel(id);
      if (layout.sidebarCollapsed) {
        updateLayout({ sidebarCollapsed: false });
      }
    },
    [layout.sidebarCollapsed, openSettings, setPanel, updateLayout]
  );

  const commands = useMemo(
    () =>
      buildCommands({
        newNote: () => void vault.newNote(),
        newExcalidrawNote: () => void vault.newExcalidrawNote(),
        newNotebookNote: () => void vault.newNotebookNote(),
        newTodoNote: () => void vault.newTodoNote(),
        openTodayNote: () => void vault.openTodayNote(),
        newFolder: () => void vault.newFolder(),
        openExplorer: () => setPanel("explorer"),
        openSearch: () => setPanel("search"),
        openTags: () => setPanel("tags"),
        openTodos: () => setPanel("todos"),
        openQuickSwitcher: () => setQsOpen(true),
        openGraph: () => setPanel("graph"),
        openSettings,
        exportVault: () => void handleExportVault(),
        cycleEditorMode,
        archiveNote: vault.currentNote ? () => void vault.archiveNote() : undefined,
        archiveLabel: vault.currentNote
          ? vault.currentNote.state === "open"
            ? "归档当前笔记"
            : "恢复当前笔记"
          : undefined,
        deleteFolder: () => void vault.deleteFolder(),
        openVaultSwitcher: () => setVaultSwitcherOpen(true),
        openCommandPalette: () => setCmdOpen(true),
        editorMode: settings.editorMode,
        folderDeletable: vault.folderDeletable,
      }),
    [vault, settings.editorMode, cycleEditorMode, openSettings, handleExportVault, setCmdOpen, setQsOpen, setPanel]
  );

  const vaultLabel = user.activeVault ? `${user.activeVault.repo}` : "未选择 Vault";
  const showRightSidebar = settings.showOutline && vault.currentNote != null;
  const sidebarWidth = layout.sidebarCollapsed ? 0 : layout.sidebarWidth;
  const rightWidth = layout.rightCollapsed ? 44 : layout.rightWidth;

  const shellStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
    "--outline-width": `${rightWidth}px`,
  } as CSSProperties;

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
        settingsOpen={settingsOpen}
        onChange={handlePanelChange}
        sidebarCollapsed={layout.sidebarCollapsed}
        onToggleSidebar={() => updateLayout({ sidebarCollapsed: !layout.sidebarCollapsed })}
      />

      {!layout.sidebarCollapsed && (
        <aside className="sidebar-panel">
          {panel === "explorer" && (
            <FileExplorer
              tree={vault.tree}
              notes={vault.vaultNotes}
              activeFolder={vault.activeFolder}
              selectedNumber={activeNumber}
              onSelectFolder={vault.setActiveFolder}
              onSelectNote={vault.openNote}
              onNewNote={() => void vault.newNote()}
              onNewExcalidrawNote={() => void vault.newExcalidrawNote()}
              onNewNotebookNote={() => void vault.newNotebookNote()}
              onNewTodoNote={() => void vault.newTodoNote()}
              onNewFolder={() => void vault.newFolder()}
              onDeleteFolder={() => void vault.deleteFolder()}
              canDeleteFolder={vault.folderDeletable}
              newNoteDisabled={vault.creatingNote}
            />
          )}
          {panel === "search" && (
            <SearchPanel key={vault.vaultKey} onOpenNote={vault.openNote} />
          )}
          {panel === "tags" && (
            <TagsPanel notes={vault.visibleNotes} onOpenNote={vault.openNote} />
          )}
          {panel === "todos" && (
            <TodoPanel
              notes={vault.visibleNotes}
              onOpenNote={vault.openNote}
              onToggleItem={vault.toggleTodoItem}
              onNewTodoNote={() => void vault.newTodoNote()}
              newNoteDisabled={vault.creatingNote}
            />
          )}
          {panel === "graph" && (
            <GraphPanel key={vault.vaultKey} onOpenNote={vault.openNote} />
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
          onNew={() => void vault.newNote()}
          onTogglePin={togglePin}
          onReorder={reorderTabs}
          newNoteDisabled={vault.creatingNote}
        />
        <div className="editor-area">
          {vault.currentNote ? (
            <NoteEditor
              ref={editorRef}
              key={vault.currentNote.number}
              note={vault.currentNote}
              editorMode={settings.editorMode}
              themeMode={settings.theme}
              imageStorage={settings.imageStorage}
              folderOptions={vault.allFolderOptions}
              allNotes={vault.vaultNotes}
              vaultName={vaultLabel}
              onOpenNote={vault.openNote}
              onCreateAndOpenNote={vault.createAndOpenNote}
              onUpdate={vault.handleNoteUpdate}
              onSaveStatus={setSaveStatus}
              onContentChange={vault.setDraftContent}
              onEditorModeChange={(m) => updateSettings({ editorMode: m })}
              onNavigateFolder={handleNavigateFolder}
              onEditorStats={setEditorStats}
              onNeedGitHubSession={openSettings}
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

      {showRightSidebar && vault.currentNote && (
        <RightSidebar
          panel={layout.rightPanel}
          onPanelChange={(p) => updateLayout({ rightPanel: p })}
          collapsed={layout.rightCollapsed}
          onToggleCollapse={() => updateLayout({ rightCollapsed: !layout.rightCollapsed })}
          content={vault.draftContent}
          noteTitle={vault.currentNote.title}
          noteNumber={vault.currentNote.number}
          notes={vault.vaultNotes}
          onJump={(line) => editorRef.current?.scrollToLine(line)}
          onOpenNote={vault.openNote}
          onResize={(delta) =>
            updateLayout({ rightWidth: Math.min(400, Math.max(160, layout.rightWidth - delta)) })
          }
        />
      )}

      <StatusBar
        vaultLabel={vaultLabel}
        saveStatus={saveStatus}
        noteNumber={activeNumber}
        noteType={vault.currentNote?.type}
        shortcutHint={!isFocused ? SHORTCUT_UNFOCUSED_HINT : undefined}
        wordCount={vault.currentNote ? editorStats.words : undefined}
        cursorLine={vault.currentNote ? editorStats.line : undefined}
        cursorCol={vault.currentNote ? editorStats.col : undefined}
        onVaultClick={() => setVaultSwitcherOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        bundle={{
          settings,
          updateSettings,
          user,
          onVaultChange: () => void refreshUser(),
          onOpenVaultSwitcher: () => {
            setSettingsOpen(false);
            setVaultSwitcherOpen(true);
          },
        }}
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
        notes={vault.visibleNotes}
        onOpen={vault.openNote}
        onClose={() => setQsOpen(false)}
      />
    </div>
  );
}

export default function AppShell({ user, onUserUpdate }: Props) {
  const vaultKey = user.activeVault
    ? `${user.activeVault.owner}/${user.activeVault.repo}`
    : "none";

  const { settings } = useSettings();
  const { activeNumber, setActiveNumber, openTab, updateTabTitle } = useTabs(vaultKey);
  const [panel, setPanel] = useState<SidebarPanel>("explorer");

  const handleOpenNoteSideEffect = useCallback(() => setPanel("explorer"), []);

  return (
    <VaultProvider
      vaultKey={vaultKey}
      showArchived={settings.showArchived}
      activeNumber={activeNumber}
      setActiveNumber={setActiveNumber}
      openTab={openTab}
      updateTabTitle={updateTabTitle}
      onOpenNote={handleOpenNoteSideEffect}
    >
      <AppShellInner user={user} onUserUpdate={onUserUpdate} panel={panel} setPanel={setPanel} />
    </VaultProvider>
  );
}
