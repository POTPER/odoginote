import { useCallback, useRef } from "react";
import {
  deleteLine,
  handleBlockquoteEnter,
  handleFormatShortcut,
  handleListEnter,
  handlePairInput,
  handleSmartPasteUrl,
  indentLines,
  moveLine,
  toggleHeading,
  type TextEdit,
} from "../../lib/markdown-edit";
import type { EditorContext, EditorHandler, WikiSuggestState } from "./editorContext";

const PAIR_KEYS = new Set(["(", "[", "{", '"', "'", "`"]);

function hasMod(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

export interface UseMarkdownEditorHandlersOptions {
  wikiSuggest: WikiSuggestState | null;
  onWikiSuggestNavigate: (direction: "up" | "down") => void;
  onWikiSuggestConfirm: () => void;
  onWikiSuggestDismiss: () => void;
  applyEdit: (edit: TextEdit) => void;
}

function createWikiSuggestHandler(options: UseMarkdownEditorHandlersOptions): EditorHandler {
  return (_ctx, e) => {
    const { wikiSuggest, onWikiSuggestNavigate, onWikiSuggestConfirm, onWikiSuggestDismiss } =
      options;
    if (!wikiSuggest) return null;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      onWikiSuggestNavigate("down");
      return "consumed";
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onWikiSuggestNavigate("up");
      return "consumed";
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      onWikiSuggestConfirm();
      return "consumed";
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onWikiSuggestDismiss();
      return "consumed";
    }
    return null;
  };
}

function createEnterHandler(): EditorHandler {
  return (ctx, e) => {
    if (e.key !== "Enter" || e.shiftKey || hasMod(e)) return null;
    const listEdit = handleListEnter(ctx.text, ctx.selectionStart);
    if (listEdit) {
      e.preventDefault();
      return listEdit;
    }
    const quoteEdit = handleBlockquoteEnter(ctx.text, ctx.selectionStart);
    if (quoteEdit) {
      e.preventDefault();
      return quoteEdit;
    }
    return null;
  };
}

function createTabHandler(): EditorHandler {
  return (ctx, e) => {
    if (e.key !== "Tab" || hasMod(e)) return null;
    e.preventDefault();
    return indentLines(ctx.text, ctx.selectionStart, ctx.selectionEnd, e.shiftKey);
  };
}

function createFormatShortcutHandler(): EditorHandler {
  return (ctx, e) => {
    if (!hasMod(e) || e.altKey) return null;
    if (e.key.toLowerCase() === "h" && !e.shiftKey) {
      e.preventDefault();
      return toggleHeading(ctx.text, ctx.selectionStart);
    }
    if (e.key.toLowerCase() === "b" && !e.shiftKey) {
      e.preventDefault();
      return handleFormatShortcut(ctx.text, ctx.selectionStart, ctx.selectionEnd, "b");
    }
    if (e.key.toLowerCase() === "i" && !e.shiftKey) {
      e.preventDefault();
      return handleFormatShortcut(ctx.text, ctx.selectionStart, ctx.selectionEnd, "i");
    }
    if (e.key === "`" && !e.shiftKey) {
      e.preventDefault();
      return handleFormatShortcut(ctx.text, ctx.selectionStart, ctx.selectionEnd, "`");
    }
    return null;
  };
}

function createLineOpsHandler(): EditorHandler {
  return (ctx, e) => {
    if (hasMod(e) && e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      return deleteLine(ctx.text, ctx.selectionStart);
    }
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      return moveLine(ctx.text, ctx.selectionStart, "up");
    }
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      return moveLine(ctx.text, ctx.selectionStart, "down");
    }
    return null;
  };
}

function createPairingHandler(): EditorHandler {
  return (ctx, e) => {
    if (hasMod(e) || e.altKey || e.key.length !== 1) return null;
    if (!PAIR_KEYS.has(e.key)) return null;
    const edit = handlePairInput(ctx.text, ctx.selectionStart, ctx.selectionEnd, e.key);
    if (!edit) return null;
    e.preventDefault();
    return edit;
  };
}

export function useMarkdownEditorHandlers(options: UseMarkdownEditorHandlersOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback((ctx: EditorContext, e: KeyboardEvent) => {
    const opts = optionsRef.current;
    const handlers: EditorHandler[] = [
      createWikiSuggestHandler(opts),
      createEnterHandler(),
      createTabHandler(),
      createFormatShortcutHandler(),
      createLineOpsHandler(),
      createPairingHandler(),
    ];

    for (const handler of handlers) {
      const result = handler(ctx, e);
      if (result === "consumed") return true;
      if (result) {
        opts.applyEdit(result);
        return true;
      }
    }
    return false;
  }, []);

  const handlePaste = useCallback(
    (ctx: EditorContext, pastedText: string): TextEdit | null => {
      return handleSmartPasteUrl(ctx.text, ctx.selectionStart, ctx.selectionEnd, pastedText);
    },
    []
  );

  return { handleKeyDown, handlePaste };
}

export function applyTextEditToTextarea(
  textarea: HTMLTextAreaElement,
  edit: TextEdit,
  onContentChange: (text: string) => void,
  onSelectionApplied?: (cursor: number) => void
): void {
  onContentChange(edit.text);
  requestAnimationFrame(() => {
    textarea.selectionStart = edit.selectionStart;
    textarea.selectionEnd = edit.selectionEnd;
    textarea.focus();
    onSelectionApplied?.(edit.selectionStart);
  });
}
