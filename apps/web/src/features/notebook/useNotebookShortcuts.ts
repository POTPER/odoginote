import { useEffect, useRef } from "react";

interface NotebookShortcutHandlers {
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDeleteSelected: () => void;
  onRunSelected: () => void;
  onMoveSelectionUp: () => void;
  onMoveSelectionDown: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function useNotebookShortcuts(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  handlers: NotebookShortcutHandlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    function onKeyDown(e: KeyboardEvent) {
      if (!root?.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }

      const typing = isTypingTarget(e.target);
      const h = handlersRef.current;

      if (e.key === "a" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        h.onInsertAbove();
        return;
      }
      if (e.key === "b" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        h.onInsertBelow();
        return;
      }
      if (e.key === "d" && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        h.onDeleteSelected();
        return;
      }
      if (e.key === "Enter" && e.shiftKey && typing && e.target instanceof HTMLTextAreaElement) {
        e.preventDefault();
        h.onRunSelected();
        return;
      }
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !typing && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        if (e.key === "ArrowUp") h.onMoveSelectionUp();
        else h.onMoveSelectionDown();
      }
    }

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [containerRef, enabled]);
}
