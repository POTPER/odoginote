import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  EditorMode,
  ImageStorage,
  NoteDetail,
  NoteSummary,
  ThemeMode,
} from "@odoginote/shared";
import { countExcalidrawElements, countNotebookCells, extractHeadings, findBacklinks, resolveLink } from "@odoginote/shared";
import { api } from "../lib/api";
import { normalizePreviewContent } from "../lib/image-url";
import {
  applyWikiLink,
  getWikiLinkContext,
  wrapSelection,
} from "../lib/markdown-edit";
import ViewHeader from "./ViewHeader";
import NoteProperties from "./NoteProperties";
import EditorToolbar from "./EditorToolbar";
import WikiLinkSuggest from "./WikiLinkSuggest";
import PreviewImage from "./PreviewImage";
import BacklinksPanel from "../panels/BacklinksPanel";
import ExcalidrawEditor from "./ExcalidrawEditor";
import NotebookEditor from "./NotebookEditor";
import { nullKernelRunner } from "../lib/kernel-runner";

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
  onSaveStatus?: (status: string) => void;
  onContentChange?: (content: string) => void;
  onEditorModeChange?: (mode: EditorMode) => void;
  onNavigateFolder?: (folder: string) => void;
  onEditorStats?: (stats: { words: number; line: number; col: number }) => void;
  onNeedGitHubSession?: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "conflict" | "error" | "uploading";

export interface NoteEditorHandle {
  saveNow: () => Promise<void>;
  scrollToLine: (line: number) => void;
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function cursorPosition(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, pos);
  const lines = before.split("\n");
  return { line: lines.length, col: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

function resolveEditorTheme(themeMode: ThemeMode): "light" | "dark" {
  if (themeMode === "light") return "light";
  if (themeMode === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(
  {
    note,
    editorMode,
    themeMode,
    imageStorage,
    folderOptions,
    allNotes,
    vaultName,
    onUpdate,
    onOpenNote,
    onSaveStatus,
    onContentChange,
    onEditorModeChange,
    onNavigateFolder,
    onEditorStats,
    onNeedGitHubSession,
  },
  ref
) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [folder, setFolder] = useState(note.folder);
  const [tagsStr, setTagsStr] = useState(note.tags.join(", "));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [wikiSuggest, setWikiSuggest] = useState<{
    query: string;
    openIdx: number;
    cursor: number;
    activeIndex: number;
  } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const updatedAtRef = useRef(note.updatedAt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorModeRef = useRef(editorMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  const noteIndexRef = useRef<NoteSummary[]>([]);
  const syncLockRef = useRef(false);
  const baselineRef = useRef({
    title: note.title,
    content: note.content,
    folder: note.folder,
    tagsStr: note.tags.join(", "),
  });
  const fieldsRef = useRef({ title, content, folder, tagsStr });

  useEffect(() => {
    fieldsRef.current = { title, content, folder, tagsStr };
  }, [title, content, folder, tagsStr]);

  async function persistNote() {
    const { title: t, content: c, folder: f, tagsStr: ts } = fieldsRef.current;
    const tags = ts
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const updated = await api.updateNote(note.number, {
      title: t,
      content: c,
      folder: f,
      tags,
      expectedUpdatedAt: updatedAtRef.current,
    });
    updatedAtRef.current = updated.updatedAt;
    baselineRef.current = {
      title: updated.title,
      content: updated.content,
      folder: updated.folder,
      tagsStr: updated.tags.join(", "),
    };
    onUpdateRef.current(updated);
    setStatus("saved");
  }

  useEffect(() => {
    editorModeRef.current = editorMode;
  }, [editorMode]);

  useEffect(() => {
    onContentChange?.(content);
  }, [content, onContentChange]);

  const emitStats = useCallback(
    (text: string, cursor: number) => {
      const { line, col } = cursorPosition(text, cursor);
      onEditorStats?.({ words: countWords(text), line, col });
    },
    [onEditorStats]
  );

  const isExcalidraw = note.type === "excalidraw";
  const isNotebook = note.type === "ipynb";
  const isStructuredNote = isExcalidraw || isNotebook;
  const excalidrawTheme = resolveEditorTheme(themeMode);

  useEffect(() => {
    if (!isExcalidraw) return;
    onEditorStats?.({ words: countExcalidrawElements(content), line: 0, col: 0 });
  }, [content, isExcalidraw, onEditorStats]);

  useEffect(() => {
    if (!isNotebook) return;
    onEditorStats?.({ words: countNotebookCells(content), line: 0, col: 0 });
  }, [content, isNotebook, onEditorStats]);

  useEffect(() => {
    if (isExcalidraw || isNotebook) return;
    emitStats(content, content.length);
  }, [content, emitStats, isExcalidraw, isNotebook]);

  function scrollToLine(line: number) {
    const mode = editorModeRef.current;
    if (mode === "split" || mode === "edit") {
      const ta = textareaRef.current;
      if (!ta) return;
      const lines = ta.value.split("\n");
      let pos = 0;
      for (let i = 0; i < line; i++) pos += lines[i].length + 1;
      ta.focus();
      const lineLen = lines[line]?.length ?? 0;
      ta.setSelectionRange(pos, pos + lineLen);
      const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
      ta.scrollTop = Math.max(0, line * lineHeight - ta.clientHeight / 3);
      setScrollTop(ta.scrollTop);
      emitStats(ta.value, pos);
      return;
    }

    const headings = extractHeadings(content);
    const heading = headings.find((h) => h.line === line);
    if (!heading) return;
    previewRef.current
      ?.querySelector(`#heading-${heading.slug}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useImperativeHandle(ref, () => ({
    saveNow: async () => {
      clearTimeout(timerRef.current);
      if (uploadingRef.current) return;
      const baseline = baselineRef.current;
      const { title: t, content: c, folder: f, tagsStr: ts } = fieldsRef.current;
      if (t === baseline.title && c === baseline.content && f === baseline.folder && ts === baseline.tagsStr) {
        return;
      }
      setStatus("saving");
      try {
        await persistNote();
      } catch (e) {
        setStatus(e instanceof Error && e.message.includes("Conflict") ? "conflict" : "error");
      }
    },
    scrollToLine,
  }));

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    api.listNotes().then(({ notes }) => {
      noteIndexRef.current = notes;
    });
  }, [note.number]);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setFolder(note.folder);
    setTagsStr(note.tags.join(", "));
    updatedAtRef.current = note.updatedAt;
    baselineRef.current = {
      title: note.title,
      content: note.content,
      folder: note.folder,
      tagsStr: note.tags.join(", "),
    };
    setStatus("idle");
    setWikiSuggest(null);
  }, [note.number, note.updatedAt, note.title, note.content, note.folder, note.tags]);

  useEffect(() => {
    const statusText = {
      idle: "",
      saving: "保存中...",
      saved: "已保存",
      conflict: "冲突",
      error: "保存失败",
      uploading: "上传图片中...",
    }[status];
    onSaveStatus?.(statusText);
  }, [status, onSaveStatus]);

  useEffect(() => {
    const baseline = baselineRef.current;
    if (
      title === baseline.title &&
      content === baseline.content &&
      folder === baseline.folder &&
      tagsStr === baseline.tagsStr
    ) {
      return;
    }
    if (uploadingRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await persistNote();
      } catch (e) {
        setStatus(e instanceof Error && e.message.includes("Conflict") ? "conflict" : "error");
      }
    }, 2000);

    return () => clearTimeout(timerRef.current);
  }, [title, content, folder, tagsStr, note.number]);

  const syncPreviewScroll = useCallback(() => {
    if (editorModeRef.current !== "split") return;
    const ta = textareaRef.current;
    const preview = previewRef.current;
    if (!ta || !preview || syncLockRef.current) return;

    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    const currentLine = Math.floor((ta.scrollTop + ta.clientHeight * 0.15) / lineHeight);
    const headings = extractHeadings(content);
    let target = headings[0];
    for (const h of headings) {
      if (h.line <= currentLine) target = h;
      else break;
    }
    if (!target) return;

    const el = preview.querySelector(`#heading-${target.slug}`);
    if (el) {
      syncLockRef.current = true;
      el.scrollIntoView({ block: "start" });
      requestAnimationFrame(() => {
        syncLockRef.current = false;
      });
    }
  }, [content]);

  function getFilteredNotes(query: string) {
    return noteIndexRef.current
      .filter(
        (n) =>
          n.number !== note.number &&
          n.title.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8);
  }

  const filteredWikiNotes = wikiSuggest ? getFilteredNotes(wikiSuggest.query) : [];

  function setCursor(pos: number) {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
      textarea.focus();
      emitStats(textarea.value, pos);
    });
  }

  function insertAtCursor(markdown: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + markdown);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const next = before + markdown + after;
    setContent(next);
    setCursor(start + markdown.length);
  }

  function applyFormat(before: string, after: string = before) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { next, cursor } = wrapSelection(content, start, end, before, after);
    setContent(next);
    setWikiSuggest(null);
    setCursor(cursor);
  }

  function updateWikiSuggest(text: string, cursor: number) {
    const ctx = getWikiLinkContext(text, cursor);
    if (!ctx) {
      setWikiSuggest(null);
      return;
    }
    setWikiSuggest((prev) => ({
      query: ctx.query,
      openIdx: ctx.openIdx,
      cursor,
      activeIndex: prev?.query === ctx.query ? prev.activeIndex : 0,
    }));
  }

  function selectWikiLink(linkTitle: string) {
    if (!wikiSuggest) return;
    const { next, cursor } = applyWikiLink(
      content,
      linkTitle,
      wikiSuggest.openIdx,
      wikiSuggest.cursor
    );
    setContent(next);
    setWikiSuggest(null);
    setCursor(cursor);
  }

  function confirmWikiSuggest() {
    if (!wikiSuggest) return;
    const matches = getFilteredNotes(wikiSuggest.query);
    const linkTitle = matches[wikiSuggest.activeIndex]?.title ?? wikiSuggest.query;
    if (!linkTitle.trim()) return;
    selectWikiLink(linkTitle.trim());
  }

  function handleContentChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(val);
    updateWikiSuggest(val, cursor);
    emitStats(val, cursor);
  }

  async function uploadAndInsertImage(file: File) {
    if (uploadingRef.current) return;
    if (!file.type.startsWith("image/")) return;

    uploadingRef.current = true;
    setStatus("uploading");
    try {
      const { url } = await api.uploadAsset(note.number, file, imageStorage);
      const alt = file.name.replace(/\.[^.]+$/, "") || "image";
      insertAtCursor(`\n![${alt}](${url})\n`);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      const code = (err as Error & { code?: string }).code;
      if (code === "GITHUB_SESSION_REQUIRED" || code === "GITHUB_SESSION_EXPIRED") {
        if (onNeedGitHubSession) {
          onNeedGitHubSession();
        } else {
          alert("请先在设置中连接 GitHub user_session，或切换为「仓库文件」图片存储。");
        }
      }
      console.error(err);
    } finally {
      uploadingRef.current = false;
    }
  }

  async function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      await uploadAndInsertImage(file);
      return;
    }
  }

  function handleDragOver(e: DragEvent<HTMLTextAreaElement>) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  async function handleDrop(e: DragEvent<HTMLTextAreaElement>) {
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) return;
    e.preventDefault();
    await uploadAndInsertImage(file);
  }

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadAndInsertImage(file);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!wikiSuggest) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const count = getFilteredNotes(wikiSuggest.query).length;
      setWikiSuggest((prev) =>
        prev
          ? {
              ...prev,
              activeIndex: Math.min(prev.activeIndex + 1, Math.max(count - 1, 0)),
            }
          : null
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setWikiSuggest((prev) =>
        prev ? { ...prev, activeIndex: Math.max(prev.activeIndex - 1, 0) } : null
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      confirmWikiSuggest();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setWikiSuggest(null);
    }
  }

  function handleInsertWikiLink() {
    const textarea = textareaRef.current;
    if (!textarea) {
      insertAtCursor("[[]]");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = content.slice(0, start) + "[[]]" + content.slice(end);
    const cursor = start + 2;
    setContent(next);
    setCursor(cursor);
    updateWikiSuggest(next, cursor);
  }

  async function openWikiLink(linkTarget: string) {
    const { notes } = await api.listNotes();
    const num = resolveLink(linkTarget, notes);
    if (num != null && onOpenNote) onOpenNote(num, linkTarget);
  }

  async function handlePreviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName !== "A") return;
    const href = target.getAttribute("href");
    if (!href?.startsWith("wiki:")) return;
    e.preventDefault();
    await openWikiLink(href.slice(5));
  }

  async function handleArchive() {
    const newState = note.state === "open" ? "closed" : "open";
    const updated = await api.updateNote(note.number, { state: newState });
    onUpdate(updated);
  }

  const previewContent = normalizePreviewContent(content);
  const backlinks = findBacklinks(note.title, note.number, allNotes);
  const folders = [...new Set([...folderOptions, folder, "inbox"])].sort();
  const showSource = editorMode === "split" || editorMode === "edit";
  const showPreview = editorMode === "split" || editorMode === "preview";
  const lineCount = content.split("\n").length;

  const markdownComponents = useMemo(() => {
    let idx = 0;
    const list = extractHeadings(content);
    const mk = (level: 1 | 2 | 3 | 4 | 5 | 6): Components[`h${typeof level}`] => {
      const Tag = `h${level}` as keyof Pick<Components, "h1" | "h2" | "h3" | "h4" | "h5" | "h6">;
      void Tag;
      return ({ children, ...props }) => {
        const h = list[idx++];
        return createElement(`h${level}`, { id: h ? `heading-${h.slug}` : undefined, ...props }, children);
      };
    };
    return {
      h1: mk(1),
      h2: mk(2),
      h3: mk(3),
      h4: mk(4),
      h5: mk(5),
      h6: mk(6),
      img: ({ src, alt }: { src?: string; alt?: string }) => (
        <PreviewImage src={src} alt={alt} onNeedGitHubSession={onNeedGitHubSession} />
      ),
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        if (href?.startsWith("wiki:")) {
          const linkTarget = href.slice(5);
          return (
            <a
              href={href}
              className="wiki-link"
              onClick={(e) => {
                e.preventDefault();
                void openWikiLink(linkTarget);
              }}
            >
              {children}
            </a>
          );
        }
        return <a href={href}>{children}</a>;
      },
    } satisfies Components;
  }, [content, onNeedGitHubSession]);

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
        onInsertImage={() => fileInputRef.current?.click()}
        onArchive={() => void handleArchive()}
        isArchived={note.state === "closed"}
        imageUploadDisabled={status === "uploading"}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        onChange={handleFilePick}
      />

      <div
        className={`note-editor-body mode-${editorMode}${isStructuredNote ? ` mode-${isExcalidraw ? "excalidraw" : "notebook"}` : ""}`}
        onClick={!isStructuredNote && editorMode !== "edit" ? handlePreviewClick : undefined}
      >
        {isExcalidraw ? (
          <div className="note-excalidraw-pane">
            <div className="note-chrome">{chromeBlock}</div>
            <ExcalidrawEditor
              noteNumber={note.number}
              content={content}
              theme={excalidrawTheme}
              onChange={setContent}
            />
          </div>
        ) : isNotebook ? (
          <div className="note-notebook-pane">
            <div className="note-chrome">{chromeBlock}</div>
            <NotebookEditor
              content={content}
              onChange={setContent}
              kernelRunner={nullKernelRunner}
            />
          </div>
        ) : (
          <>
        {showSource && (
          <div className="note-source-pane">
            <div className="note-chrome">{chromeBlock}</div>
            <EditorToolbar
              onFormat={applyFormat}
              onInsertLink={handleInsertWikiLink}
              disabled={status === "uploading"}
            />
            <div className="note-source-editor">
              <div className="line-gutter" aria-hidden="true">
                <div className="line-gutter-inner" style={{ transform: `translateY(-${scrollTop}px)` }}>
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} className="line-num">
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
              <div className="note-editor-input-wrap">
                <textarea
                  ref={textareaRef}
                  className="note-textarea"
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onScroll={(e) => {
                    setScrollTop(e.currentTarget.scrollTop);
                    syncPreviewScroll();
                  }}
                  onClick={(e) => {
                    updateWikiSuggest(content, e.currentTarget.selectionStart);
                    emitStats(content, e.currentTarget.selectionStart);
                  }}
                  onKeyUp={(e) => emitStats(content, e.currentTarget.selectionStart)}
                  placeholder="Markdown...（[[ 链笔记，支持粘贴/拖拽图片）"
                />
                {wikiSuggest && (
                  <WikiLinkSuggest
                    items={filteredWikiNotes}
                    activeIndex={wikiSuggest.activeIndex}
                    onSelect={selectWikiLink}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {showPreview && (
          <div className="note-preview-pane">
            <div className="markdown-preview readable">
              <div className="readable-inner">
                {editorMode === "preview" && (
                  <div className="note-chrome preview-chrome">{chromeBlock}</div>
                )}
                {editorMode === "split" && title && <h1 className="readable-title">{title}</h1>}
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {previewContent || "*预览*"}
                </ReactMarkdown>
                <BacklinksPanel backlinks={backlinks} onOpenNote={onOpenNote} compact />
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
});

export default NoteEditor;
