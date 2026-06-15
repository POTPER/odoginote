import { useEffect } from "react";
import { matchShortcut } from "../lib/shortcuts";

export interface AppShortcutsOptions {
  enabled: boolean;
  modalOpen: boolean;
  onToggleCommandPalette: () => void;
  onToggleQuickSwitcher: () => void;
  onCloseModals: () => void;
  onNewNote: () => void;
  onSave: () => void;
  onCloseTab: () => void;
  onToggleEditorMode: () => void;
  onOpenSearch: () => void;
  onOpenExplorer: () => void;
  onOpenTodayNote: () => void;
}

export function useAppShortcuts({
  enabled,
  modalOpen,
  onToggleCommandPalette,
  onToggleQuickSwitcher,
  onCloseModals,
  onNewNote,
  onSave,
  onCloseTab,
  onToggleEditorMode,
  onOpenSearch,
  onOpenExplorer,
  onOpenTodayNote,
}: AppShortcutsOptions) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && modalOpen) {
        onCloseModals();
        return;
      }

      if (!enabled || modalOpen) return;

      if (matchShortcut(e, "newNote")) {
        e.preventDefault();
        onNewNote();
      } else if (matchShortcut(e, "save")) {
        e.preventDefault();
        onSave();
      } else if (matchShortcut(e, "closeTab")) {
        e.preventDefault();
        onCloseTab();
      } else if (matchShortcut(e, "toggleEditorMode")) {
        e.preventDefault();
        onToggleEditorMode();
      } else if (matchShortcut(e, "search")) {
        e.preventDefault();
        onOpenSearch();
      } else if (matchShortcut(e, "explorer")) {
        e.preventDefault();
        onOpenExplorer();
      } else if (matchShortcut(e, "todayNote")) {
        e.preventDefault();
        onOpenTodayNote();
      } else if (matchShortcut(e, "commandPalette")) {
        e.preventDefault();
        onToggleCommandPalette();
      } else if (matchShortcut(e, "quickSwitcher")) {
        e.preventDefault();
        onToggleQuickSwitcher();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    enabled,
    modalOpen,
    onToggleCommandPalette,
    onToggleQuickSwitcher,
    onCloseModals,
    onNewNote,
    onSave,
    onCloseTab,
    onToggleEditorMode,
    onOpenSearch,
    onOpenExplorer,
    onOpenTodayNote,
  ]);
}
