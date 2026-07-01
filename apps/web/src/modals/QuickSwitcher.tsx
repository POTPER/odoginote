import type { NoteSummary } from "@odoginote/shared";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useListKeyboardNav } from "../hooks/useListKeyboardNav";
import { highlightMatch } from "../lib/highlight";

interface Props {
  open: boolean;
  notes: NoteSummary[];
  onOpen: (number: number, title: string) => void;
  onClose: () => void;
}

export default function QuickSwitcher({ open, notes, onOpen, onClose }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    const sorted = [...notes].sort((a, b) => a.title.localeCompare(b.title));
    if (!q) return sorted.slice(0, 20);
    return sorted
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          String(n.number).includes(q) ||
          n.folder.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [notes, filter]);

  const { activeIndex, setActiveIndex, handleKeyDown: handleListKeyDown } = useListKeyboardNav({
    items: filtered,
    enabled: open,
    onSelect: (n) => {
      onOpen(n.number, n.title);
      setFilter("");
      onClose();
    },
    onEscape: onClose,
  });

  useEffect(() => {
    if (!open) setFilter("");
  }, [open]);

  if (!open) return null;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    handleListKeyDown(e);
  }

  return (
    <div className="modal-overlay cmd-overlay" onClick={onClose}>
      <div className="command-palette quick-switcher" onClick={(e) => e.stopPropagation()}>
        <input
          className="cmd-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="跳转到笔记..."
          autoFocus
        />
        <ul className="cmd-list">
          {filtered.map((n, i) => (
            <li key={n.number}>
              <button
                type="button"
                className={i === activeIndex ? "active" : ""}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onOpen(n.number, n.title);
                  setFilter("");
                  onClose();
                }}
              >
                <span className="qs-title">
                  {filter ? <HighlightInline text={n.title} query={filter} /> : n.title}
                </span>
                <span className="qs-meta">
                  #{n.number} · {n.folder}
                  {n.state === "closed" && " · 已归档"}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="panel-muted">无匹配笔记</li>}
        </ul>
      </div>
    </div>
  );
}

function HighlightInline({ text, query }: { text: string; query: string }) {
  const parts = highlightMatch(text, query);
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="search-highlight">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}
