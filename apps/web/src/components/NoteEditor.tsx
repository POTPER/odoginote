import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { ImageStorage, NoteDetail, NoteSummary } from "@odoginote/shared";
import { countExcalidrawElements, countNotebookCells, countTodoItems } from "@odoginote/shared";
import { api } from "../lib/api";
import type { EditorMode, ThemeMode } from "../types/ui";
import ViewHeader from "./ViewHeader";
import NoteProperties from "./NoteProperties";
import ExcalidrawEditor from "./ExcalidrawEditor";
import NotebookEditor from "./NotebookEditor";
import TodoEditor from "./TodoEditor";
import { useKernelRunner } from "../features/notebook/useKernelRunner";
import { useNotePersistence } from "../features/editor/useNotePersistence";
import MarkdownNoteEditor, {
  type MarkdownNoteEditorHandle,
} from "../features/editor/MarkdownNoteEditor";

interface Props {
  note: NoteDetail;
  editorMode: EditorMode;
  themeMode: ThemeMode;
  imageStorage: ImageStorage;
  folderOptions: string[];
  allNotes: NoteSummary[];
  vaultName?: string;
  onUpdate: (note: NoteDetail) => void;
  onOpenNote?: (number: number, title: string) => void;
  onCreateAndOpenNote?: (title: string, folder?: string) => void | Promise<void>;
  onSaveStatus?: (status: string) => void;
  onContentChange?: (content: string) => void;
  onEditorModeChange?: (mode: EditorMode) => void;
  onNavigateFolder?: (folder: string) => void;
  onEditorStats?: (stats: { words: number; line: number; col: number }) => void;
  onNeedGitHubSession?: () => void;
}

export interface NoteEditorHandle {
  saveNow: () => Promise<void>;
  scrollToLine: (line: number) => void;
}

function resolveEditorTheme(themeMode: ThemeMode): "light" | "dark" {
  if (themeMode === "light") return "light";
  if (themeMode === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(props, ref) {
  const {
    note,
    editorMode,
    themeMode,
    imageStorage,
    folderOptions,
    allNotes,
    vaultName,
    onUpdate,
    onOpenNote,
    onCreateAndOpenNote,
    onSaveStatus,
    onContentChange,
    onEditorModeChange,
    onNavigateFolder,
    onEditorStats,
    onNeedGitHubSession,
  } = props;

  const markdownRef = useRef<MarkdownNoteEditorHandle>(null);
  const previewTheme = resolveEditorTheme(themeMode);

  const {
    title,
    setTitle,
    content,
    setContent,
    folder,
    setFolder,
    tagsStr,
    setTagsStr,
    status,
    setStatus,
    uploadingRef,
    saveNow,
  } = useNotePersistence({
    note,
    onUpdate,
    onSaveStatus,
    onContentChange,
  });

  const isExcalidraw = note.type === "excalidraw";
  const isNotebook = note.type === "ipynb";
  const isTodo = note.type === "todo";
  const isStructuredNote = isExcalidraw || isNotebook || isTodo;

  const {
    runner: kernelRunner,
    status: kernelStatus,
    kernelDisplayName,
    connectionError: kernelConnectionError,
    reconnect: reconnectKernel,
  } = useKernelRunner(isNotebook);

  useEffect(() => {
    if (!isExcalidraw) return;
    onEditorStats?.({ words: countExcalidrawElements(content), line: 0, col: 0 });
  }, [content, isExcalidraw, onEditorStats]);

  useEffect(() => {
    if (!isNotebook) return;
    onEditorStats?.({ words: countNotebookCells(content), line: 0, col: 0 });
  }, [content, isNotebook, onEditorStats]);

  useEffect(() => {
    if (!isTodo) return;
    const { total, done } = countTodoItems(content);
    onEditorStats?.({ words: total, line: done, col: 0 });
  }, [content, isTodo, onEditorStats]);

  const scrollToLine = useCallback((line: number) => {
    markdownRef.current?.scrollToLine(line);
  }, []);

  useImperativeHandle(ref, () => ({ saveNow, scrollToLine }));

  async function handleArchive() {
    const newState = note.state === "open" ? "closed" : "open";
    const updated = await api.updateNote(note.number, { state: newState });
    onUpdate(updated);
  }

  const folders = [...new Set([...folderOptions, folder, "inbox"])].sort();

  const chromeBlock = (
    <>
      <input
        className="inline-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="无标题"
      />
      <NoteProperties
        folder={folder}
        folders={folders}
        tagsStr={tagsStr}
        updatedAt={note.updatedAt}
        onFolderChange={setFolder}
        onTagsChange={setTagsStr}
      />
    </>
  );

  return (
    <div className="note-editor">
      <ViewHeader
        folder={folder}
        vaultName={vaultName}
        noteType={note.type}
        editorMode={editorMode}
        onEditorModeChange={(m) => onEditorModeChange?.(m)}
        onNavigateFolder={(f) => onNavigateFolder?.(f)}
        onInsertImage={() => markdownRef.current?.openImagePicker()}
        onArchive={() => void handleArchive()}
        isArchived={note.state === "closed"}
        imageUploadDisabled={status === "uploading"}
      />

      <div
        className={`note-editor-body mode-${editorMode}${isStructuredNote ? ` mode-${isExcalidraw ? "excalidraw" : isNotebook ? "notebook" : "todo"}` : ""}`}
      >
        {isExcalidraw ? (
          <div className="note-excalidraw-pane">
            <div className="note-chrome">{chromeBlock}</div>
            <ExcalidrawEditor
              noteNumber={note.number}
              content={content}
              theme={previewTheme}
              onChange={setContent}
            />
          </div>
        ) : isNotebook ? (
          <div className="note-notebook-pane">
            <div className="note-chrome">{chromeBlock}</div>
            <NotebookEditor
              content={content}
              onChange={setContent}
              kernelRunner={kernelRunner}
              kernelStatus={kernelStatus}
              kernelDisplayName={kernelDisplayName}
              kernelError={kernelConnectionError}
              onReconnect={reconnectKernel}
              theme={previewTheme}
            />
          </div>
        ) : isTodo ? (
          <div className="note-todo-pane">
            <div className="note-chrome">{chromeBlock}</div>
            <TodoEditor content={content} onChange={setContent} />
          </div>
        ) : (
          <MarkdownNoteEditor
            ref={markdownRef}
            noteNumber={note.number}
            title={title}
            content={content}
            folder={folder}
            editorMode={editorMode}
            previewTheme={previewTheme}
            imageStorage={imageStorage}
            allNotes={allNotes}
            status={status}
            setStatus={setStatus}
            uploadingRef={uploadingRef}
            onContentChange={setContent}
            onOpenNote={onOpenNote}
            onCreateAndOpenNote={onCreateAndOpenNote}
            onNeedGitHubSession={onNeedGitHubSession}
            onEditorStats={onEditorStats}
            chromeBlock={chromeBlock}
          />
        )}
      </div>
    </div>
  );
});

export default NoteEditor;
