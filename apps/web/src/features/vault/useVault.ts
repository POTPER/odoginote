import { createContext, useContext } from "react";
import type { FileTreeNode, NoteDetail, NoteSummary } from "@odoginote/shared";

export interface VaultContextValue {
  vaultKey: string;
  tree: FileTreeNode[];
  folderList: string[];
  vaultNotes: NoteSummary[];
  visibleNotes: NoteSummary[];
  allFolderOptions: string[];
  activeFolder: string | null;
  setActiveFolder: (folder: string | null) => void;
  currentNote: NoteDetail | null;
  draftContent: string;
  setDraftContent: (content: string) => void;
  creatingNote: boolean;
  folderDeletable: boolean;
  loadTree: () => Promise<void>;
  openNote: (number: number, title: string) => void;
  createAndOpenNote: (title: string, folder?: string) => Promise<void>;
  newNote: (kind?: "markdown" | "excalidraw" | "ipynb" | "todo") => Promise<void>;
  newExcalidrawNote: () => Promise<void>;
  newNotebookNote: () => Promise<void>;
  newTodoNote: () => Promise<void>;
  newFolder: () => Promise<void>;
  deleteFolder: () => Promise<void>;
  archiveNote: () => Promise<void>;
  openTodayNote: () => Promise<void>;
  exportVault: () => Promise<string>;
  handleNoteUpdate: (updated: NoteDetail) => void;
  toggleTodoItem: (
    noteNumber: number,
    groupId: string,
    itemId: string,
    done: boolean
  ) => Promise<void>;
  resetVaultSession: () => void;
}

export const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
