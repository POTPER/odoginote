import {
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ImageStorage, NoteSummary } from "@odoginote/shared";
import type { EditorMode } from "../../types/ui";
import { extractHeadings, resolveLink } from "@odoginote/shared";
import { api } from "../../lib/api";
import { normalizePreviewContent } from "../../lib/image-url";
import {
  applyWikiLink,
  getCompletedWikiLinkAtCursor,
  getWikiLinkContext,
  insertAtSelection,
  toggleHeading,
  wrapSelection,
  type TextEdit,
} from "../../lib/markdown-edit";
import { createNoteMarkdownComponents } from "../../lib/markdown-components";
import EditorToolbar from "../../components/EditorToolbar";
import WikiLinkSuggest from "../../components/WikiLinkSuggest";
import type { SaveStatus } from "./useNotePersistence";
import type { EditorContext } from "./editorContext";
import {
  applyTextEditToTextarea,
  useMarkdownEditorHandlers,
} from "./useMarkdownEditorHandlers";

export interface MarkdownNoteEditorHandle {
  scrollToLine: (line: number) => void;
  openImagePicker: () => void;
}

interface Props {
  noteNumber: number;
  title: string;
  content: string;
  folder: string;
  editorMode: EditorMode;
  previewTheme: "light" | "dark";
  imageStorage: ImageStorage;
  allNotes: NoteSummary[];
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
  uploadingRef: React.MutableRefObject<boolean>;
  onContentChange: (content: string) => void;
  onOpenNote?: (number: number, title: string) => void;
  onCreateAndOpenNote?: (title: string, folder?: string) => void | Promise<void>;
  onNeedGitHubSession?: () => void;
  onEditorStats?: (stats: { words: number; line: number; col: number }) => void;
  chromeBlock: ReactNode;
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

const MarkdownNoteEditor = forwardRef<MarkdownNoteEditorHandle, Props>(function MarkdownNoteEditor(
  {
    noteNumber,
    title,
    content,
    folder,
    editorMode,
    previewTheme,
    imageStorage,
    allNotes,
    status,
    setStatus,
    uploadingRef,
    onContentChange,
    onOpenNote,
    onCreateAndOpenNote,
    onNeedGitHubSession,
    onEditorStats,
    chromeBlock,
  },
  ref
) {
  const [wikiSuggest, setWikiSuggest] = useState<{
    query: string;
    openIdx: number;
    cursor: number;
    activeIndex: number;
  } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [cursorLine, setCursorLine] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorModeRef = useRef(editorMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteIndexRef = useRef(allNotes);
  const syncLockRef = useRef(false);

  useEffect(() => {
    editorModeRef.current = editorMode;
  }, [editorMode]);

  useEffect(() => {
    noteIndexRef.current = allNotes;
  }, [allNotes]);

  const emitStats = useCallback(
    (text: string, cursor: number) => {
      const { line, col } = cursorPosition(text, cursor);
      setCursorLine(line);
      onEditorStats?.({ words: countWords(text), line, col });
    },
    [onEditorStats]
  );

  useEffect(() => {
    emitStats(content, content.length);
  }, [content, emitStats]);

  const showSource = editorMode === "split" || editorMode === "edit";
  const showPreview = editorMode === "split" || editorMode === "preview";
  const lineCount = content.split("\n").length;

  const followWikiLink = useCallback(
    async (linkTarget: string) => {
      const num = resolveLink(linkTarget, allNotes);
      if (num != null) {
        const resolved = allNotes.find((n) => n.number === num);
        onOpenNote?.(num, resolved?.title ?? linkTarget);
        return;
      }
      await onCreateAndOpenNote?.(linkTarget, folder);
    },
    [allNotes, folder, onOpenNote, onCreateAndOpenNote]
  );

  const markdownLinkMode = editorMode === "preview" ? "reader" : "editor";
  const markdownComponents = useMemo(
    () =>
      createNoteMarkdownComponents({
        content,
        theme: previewTheme,
        notes: allNotes,
        linkMode: markdownLinkMode,
        onNeedGitHubSession,
        onOpenWikiLink: (target) => void followWikiLink(target),
      }),
    [content, previewTheme, allNotes, markdownLinkMode, onNeedGitHubSession, followWikiLink]
  );

  const previewContent = normalizePreviewContent(content);

  function getFilteredNotes(query: string) {
    return noteIndexRef.current
      .filter(
        (n) => n.number !== noteNumber && n.title.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8);
  }

  const filteredWikiNotes = wikiSuggest ? getFilteredNotes(wikiSuggest.query) : [];

  const applyEdit = useCallback(
    (edit: TextEdit) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onContentChange(edit.text);
        return;
      }
      setWikiSuggest(null);
      applyTextEditToTextarea(textarea, edit, onContentChange, (cursor) => {
        emitStats(edit.text, cursor);
        updateWikiSuggest(edit.text, cursor);
      });
    },
    [onContentChange, emitStats]
  );

  function getEditorContext(): EditorContext {
    const textarea = textareaRef.current;
    return {
      text: content,
      selectionStart: textarea?.selectionStart ?? content.length,
      selectionEnd: textarea?.selectionEnd ?? content.length,
      textareaRef,
    };
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
    applyEdit(
      applyWikiLink(content, linkTitle, wikiSuggest.openIdx, wikiSuggest.cursor)
    );
  }

  function confirmWikiSuggest() {
    if (!wikiSuggest) return;
    const matches = getFilteredNotes(wikiSuggest.query);
    const linkTitle = matches[wikiSuggest.activeIndex]?.title ?? wikiSuggest.query;
    if (!linkTitle.trim()) return;
    selectWikiLink(linkTitle.trim());
  }

  const { handleKeyDown: runEditorKeyDown, handlePaste: runSmartPaste } =
    useMarkdownEditorHandlers({
      wikiSuggest,
      onWikiSuggestNavigate: (direction) => {
        if (!wikiSuggest) return;
        const count = getFilteredNotes(wikiSuggest.query).length;
        setWikiSuggest((prev) => {
          if (!prev) return null;
          if (direction === "down") {
            return {
              ...prev,
              activeIndex: Math.min(prev.activeIndex + 1, Math.max(count - 1, 0)),
            };
          }
          return { ...prev, activeIndex: Math.max(prev.activeIndex - 1, 0) };
        });
      },
      onWikiSuggestConfirm: confirmWikiSuggest,
      onWikiSuggestDismiss: () => setWikiSuggest(null),
      applyEdit,
    });

  function applyFormat(before: string, after: string = before) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    applyEdit(
      wrapSelection(content, textarea.selectionStart, textarea.selectionEnd, before, after)
    );
  }

  function applyHeadingToggle() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    applyEdit(toggleHeading(content, textarea.selectionStart));
  }

  function insertAtCursor(markdown: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      onContentChange(content + markdown);
      return;
    }
    applyEdit(
      insertAtSelection(content, textarea.selectionStart, textarea.selectionEnd, markdown)
    );
  }

  function handleContentChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    onContentChange(val);
    updateWikiSuggest(val, cursor);
    emitStats(val, cursor);
  }

  async function uploadAndInsertImage(file: File) {
    if (uploadingRef.current) return;
    if (!file.type.startsWith("image/")) return;

    uploadingRef.current = true;
    setStatus("uploading");
    try {
      const { url } = await api.uploadAsset(noteNumber, file, imageStorage);
      const alt = file.name.replace(/\.[^.]+$/, "") || "image";
      insertAtCursor(`\n![${alt}](${url})\n`);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      const code = (err as Error & { code?: string }).code;
      if (code === "GITHUB_SESSION_REQUIRED" || code === "GITHUB_SESSION_EXPIRED") {
        if (onNeedGitHubSession) onNeedGitHubSession();
        else alert("请先在设置中连接 GitHub user_session，或切换为「仓库文件」图片存储。");
      }
      console.error(err);
    } finally {
      uploadingRef.current = false;
    }
  }

  async function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        await uploadAndInsertImage(file);
        return;
      }
    }

    const pastedText = e.clipboardData?.getData("text/plain") ?? "";
    const smartEdit = runSmartPaste(getEditorContext(), pastedText);
    if (smartEdit) {
      e.preventDefault();
      applyEdit(smartEdit);
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

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    runEditorKeyDown(getEditorContext(), e.nativeEvent);
  }

  function handleInsertWikiLink() {
    const textarea = textareaRef.current;
    if (!textarea) {
      insertAtCursor("[[]]");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const edit = insertAtSelection(content, start, end, "[[]]");
    applyEdit(edit);
    updateWikiSuggest(edit.text, start + 2);
  }

  function handleTextareaClick(e: MouseEvent<HTMLTextAreaElement>) {
    const pos = e.currentTarget.selectionStart;
    if (e.ctrlKey || e.metaKey) {
      const link = getCompletedWikiLinkAtCursor(content, pos);
      if (link) {
        e.preventDefault();
        void followWikiLink(link.target);
        return;
      }
    }
    updateWikiSuggest(content, pos);
    emitStats(content, pos);
  }

  const syncPreviewScroll = useCallback(() => {
    if (editorModeRef.current !== "split") return;
    const ta = textareaRef.current;
    const preview = previewRef.current;
    if (!ta || !preview || syncLockRef.current) return;

    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    const scrollable = Math.max(ta.scrollHeight - ta.clientHeight, 1);
    const scrollRatio = ta.scrollTop / scrollable;
    const currentLine = Math.floor((ta.scrollTop + ta.clientHeight * 0.15) / lineHeight);

    const headings = extractHeadings(content);
    if (headings.length === 0) {
      preview.scrollTop = scrollRatio * Math.max(preview.scrollHeight - preview.clientHeight, 0);
      return;
    }

    let target = headings[0];
    for (const h of headings) {
      if (h.line <= currentLine) target = h;
      else break;
    }

    const el = preview.querySelector(`#heading-${target.slug}`) as HTMLElement | null;
    if (!el) return;

    syncLockRef.current = true;
    const previewScrollable = Math.max(preview.scrollHeight - preview.clientHeight, 1);
    const anchorTop = el.offsetTop;
    const nextHeading = headings.find((h) => h.line > target.line);
    let segmentEnd = previewScrollable;
    if (nextHeading) {
      const nextEl = preview.querySelector(`#heading-${nextHeading.slug}`) as HTMLElement | null;
      if (nextEl) segmentEnd = nextEl.offsetTop;
    }

    const segmentStart = anchorTop;
    const segmentHeight = Math.max(segmentEnd - segmentStart, 1);
    const sourceLineStart = target.line;
    const sourceLineEnd = nextHeading?.line ?? content.split("\n").length;
    const sourceSegmentLines = Math.max(sourceLineEnd - sourceLineStart, 1);
    const lineInSegment = Math.min(
      Math.max(currentLine - sourceLineStart, 0),
      sourceSegmentLines
    );
    const segmentRatio = lineInSegment / sourceSegmentLines;
    preview.scrollTop = segmentStart + segmentRatio * segmentHeight - ta.clientHeight * 0.15;

    requestAnimationFrame(() => {
      syncLockRef.current = false;
    });
  }, [content]);

  const scrollToLine = useCallback(
    (line: number) => {
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
      const heading = extractHeadings(content).find((h) => h.line === line);
      if (!heading) return;
      previewRef.current
        ?.querySelector(`#heading-${heading.slug}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [content, emitStats]
  );

  useImperativeHandle(ref, () => ({
    scrollToLine,
    openImagePicker: () => fileInputRef.current?.click(),
  }));

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadAndInsertImage(file);
        }}
      />
      {showSource && (
        <div className="note-source-pane">
          <div className="note-chrome">{chromeBlock}</div>
          <EditorToolbar
            onFormat={applyFormat}
            onInsertLink={handleInsertWikiLink}
            onToggleHeading={applyHeadingToggle}
            disabled={status === "uploading"}
          />
          <div className="note-source-editor">
            <div className="line-gutter" aria-hidden="true">
              <div className="line-gutter-inner" style={{ transform: `translateY(-${scrollTop}px)` }}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <div
                    key={i}
                    className={`line-num${i + 1 === cursorLine ? " active" : ""}`}
                  >
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
                onClick={handleTextareaClick}
                onKeyUp={(e) => emitStats(content, e.currentTarget.selectionStart)}
                placeholder="Markdown...（[[ 链笔记，Ctrl+点击跳转，支持粘贴/拖拽图片）"
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
          <div
            ref={previewRef}
            className={`markdown-preview${editorMode === "preview" ? " readable" : " readable-compact"}`}
          >
            <div className={editorMode === "preview" ? "readable-inner" : "readable-compact-inner"}>
              {editorMode === "preview" && (
                <div className="note-chrome preview-chrome">{chromeBlock}</div>
              )}
              {editorMode === "split" && title && <h1 className="readable-title">{title}</h1>}
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {previewContent || "*预览*"}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default MarkdownNoteEditor;
