import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

interface Options<T> {
  items: T[];
  enabled?: boolean;
  onSelect: (item: T) => void;
  onEscape?: () => void;
}

export function useListKeyboardNav<T>({ items, enabled = true, onSelect, onEscape }: Options<T>) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items.length > 0) {
        e.preventDefault();
        onSelect(items[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onEscape?.();
      }
    },
    [enabled, items, activeIndex, onSelect, onEscape]
  );

  return { activeIndex, setActiveIndex, handleKeyDown };
}
