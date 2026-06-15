import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

const FOCUSABLE_SELECTOR = "input, textarea, select, button, a[href], [contenteditable]";

export function useAppFocus() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const updateFocused = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      setIsFocused(false);
      return;
    }
    setIsFocused(root.contains(document.activeElement));
  }, []);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    updateFocused();
  }, [updateFocused]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onFocusChange = () => {
      requestAnimationFrame(updateFocused);
    };

    root.addEventListener("focusin", onFocusChange, true);
    root.addEventListener("focusout", onFocusChange, true);
    document.addEventListener("focusin", onFocusChange, true);
    document.addEventListener("focusout", onFocusChange, true);

    return () => {
      root.removeEventListener("focusin", onFocusChange, true);
      root.removeEventListener("focusout", onFocusChange, true);
      document.removeEventListener("focusin", onFocusChange, true);
      document.removeEventListener("focusout", onFocusChange, true);
    };
  }, [updateFocused]);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(FOCUSABLE_SELECTOR)) return;
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  return { rootRef, isFocused, handleMouseDown };
}
