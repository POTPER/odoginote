import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FileTreeNode, NoteDetail, NoteSummary, NoteType } from "@odoginote/shared";
import {
  buildFileTree,
  canDeleteFolder,
  parseTodoContent,
  serializeTodoContent,
  todayIsoDate,
  updateTodoItem,
} from "@odoginote/shared";
import { api } from "../../lib/api";
import type { TabItem } from "../../hooks/useAppState";
import { VaultContext, type VaultContextValue } from "./useVault";

interface Props {
  vaultKey: string;
  showArchived: boolean;
  activeNumber: number | null;
  setActiveNumber: (number: number | null) => void;
  openTab: (item: TabItem) => void;
  updateTabTitle: (number: number, title: string) => void;
  onOpenNote?: () => void;
  children: ReactNode;
}

export default function VaultProvider({
  vaultKey,
  showArchived,
  activeNumber,
  setActiveNumber,
  openTab,
  updateTabTitle,
  onOpenNote,
  children,
}: Props) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [folderList, setFolderList] = useState<string[]>([]);
  const [vaultNotes, setVaultNotes] = useState<NoteSummary[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteDetail | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const creatingNoteRef = useRef(false);

  const visibleNotes = useMemo(
    () => (showArchived ? vaultNotes : vaultNotes.filter((n) => n.state === "open")),
    [vaultNotes, showArchived]
  );

  const loadTree = useCallback(async () => {
    const data = await api.getFolders();
    setFolderList(data.folders);
    setVaultNotes(data.notes);
    const visible = showArchived ? data.notes : data.notes.filter((n) => n.state === "open");
    setTree(buildFileTree(data.folders, visible));
  }, [showArchived]);

  useEffect(() => {
    void loadTree();
  }, [loadTree, vaultKey]);

  useEffect(() => {
    if (activeNumber == null) {
      setCurrentNote(null);
      setDraftContent("");
      return;
    }
    api
      .getNote(activeNumber)
      .then((note) => {
        setCurrentNote(note);
        setDraftContent(note.content);
      })
      .catch(console.error);
  }, [activeNumber, vaultKey]);

  const openNote = useCallback(
    (number: number, title: string) => {
      openTab({ number, title });
      onOpenNote?.();
    },
    [openTab, onOpenNote]
  );

  const runCreate = useCallback(
    async (payload: Parameters<typeof api.createNote>[0]) => {
      if (creatingNoteRef.current) return;
      creatingNoteRef.current = true;
      setCreatingNote(true);
      try {
        const note = await api.createNote(payload);
        await loadTree();
        openNote(note.number, note.title);
      } finally {
        creatingNoteRef.current = false;
        setCreatingNote(false);
      }
    },
    [loadTree, openNote]
  );

  const createAndOpenNote = useCallback(
    async (title: string, folder?: string) => {
      await runCreate({
        title,
        folder: folder ?? activeFolder ?? "inbox",
        content: "",
      });
    },
    [runCreate, activeFolder]
  );

  const newNote = useCallback(
    async (kind: "markdown" | "excalidraw" | "ipynb" | "todo" = "markdown") => {
      const templates: Record<
        typeof kind,
        { title: string; type?: NoteType; content?: string }
      > = {
        markdown: { title: "Untitled", content: "" },
        excalidraw: { title: "Untitled Drawing", type: "excalidraw" },
        ipynb: { title: "Untitled Notebook", type: "ipynb" },
        todo: { title: "Untitled Todo", type: "todo" },
      };
      const t = templates[kind];
      await runCreate({
        title: t.title,
        folder: activeFolder ?? "inbox",
        content: t.content,
        type: t.type,
      });
    },
    [runCreate, activeFolder]
  );

  const newExcalidrawNote = useCallback(() => newNote("excalidraw"), [newNote]);
  const newNotebookNote = useCallback(() => newNote("ipynb"), [newNote]);
  const newTodoNote = useCallback(() => newNote("todo"), [newNote]);

  const newFolder = useCallback(async () => {
    const name = prompt("文件夹名称（可用 / 表示层级，如 projects/docs）");
    if (!name?.trim()) return;
    const base = activeFolder ? `${activeFolder}/` : "";
    await api.createFolder(`${base}${name.trim()}`);
    await loadTree();
  }, [activeFolder, loadTree]);

  const deleteFolder = useCallback(async () => {
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

  const archiveNote = useCallback(async () => {
    if (!currentNote) return;
    const newState = currentNote.state === "open" ? "closed" : "open";
    const updated = await api.updateNote(currentNote.number, { state: newState });
    setCurrentNote(updated);
    await loadTree();
  }, [currentNote, loadTree]);

  const openTodayNote = useCallback(async () => {
    const today = todayIsoDate();
    const existing = vaultNotes.find((n) => n.daily === today && n.state === "open");
    if (existing) {
      openNote(existing.number, existing.title);
      return;
    }
    await runCreate({
      title: today,
      folder: "daily",
      content: `# ${today}\n\n`,
      daily: today,
    });
  }, [vaultNotes, openNote, runCreate]);

  const exportVault = useCallback(async () => {
    const res = await api.exportVault();
    return (
      `导出完成：${res.noteCount} 篇笔记，${res.mirroredAttachments} 张图片` +
      (res.skippedAttachments.length > 0 ? `，跳过 ${res.skippedAttachments.length} 张外链` : "")
    );
  }, []);

  const handleNoteUpdate = useCallback(
    (updated: NoteDetail) => {
      setCurrentNote(updated);
      setDraftContent(updated.content);
      updateTabTitle(updated.number, updated.title);
      void loadTree();
    },
    [updateTabTitle, loadTree]
  );

  const toggleTodoItem = useCallback(
    async (noteNumber: number, groupId: string, itemId: string, done: boolean) => {
      const cached = vaultNotes.find((n) => n.number === noteNumber);
      const content = cached?.content ?? (await api.getNote(noteNumber)).content;
      const list = parseTodoContent(content);
      const updated = updateTodoItem(list, groupId, itemId, { done });
      const serialized = serializeTodoContent(updated);
      const note = await api.updateNote(noteNumber, { content: serialized });
      if (currentNote?.number === noteNumber) {
        setCurrentNote(note);
        setDraftContent(serialized);
      }
      await loadTree();
    },
    [vaultNotes, currentNote, loadTree]
  );

  const resetVaultSession = useCallback(() => {
    setCurrentNote(null);
    setDraftContent("");
    setActiveNumber(null);
  }, [setActiveNumber]);

  const folderDeletable =
    activeFolder != null && canDeleteFolder(activeFolder, folderList, vaultNotes);

  const allFolderOptions = useMemo(() => {
    const set = new Set([...folderList, ...vaultNotes.map((n) => n.folder || "inbox")]);
    return [...set].sort();
  }, [folderList, vaultNotes]);

  const value: VaultContextValue = {
    vaultKey,
    tree,
    folderList,
    vaultNotes,
    visibleNotes,
    allFolderOptions,
    activeFolder,
    setActiveFolder,
    currentNote,
    draftContent,
    setDraftContent,
    creatingNote,
    folderDeletable,
    loadTree,
    openNote,
    createAndOpenNote,
    newNote,
    newExcalidrawNote,
    newNotebookNote,
    newTodoNote,
    newFolder,
    deleteFolder,
    archiveNote,
    openTodayNote,
    exportVault,
    handleNoteUpdate,
    toggleTodoItem,
    resetVaultSession,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
