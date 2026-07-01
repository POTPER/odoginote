import type { NoteSummary } from "@odoginote/shared";
import { useEffect, useState, type KeyboardEvent } from "react";
import { api } from "../lib/api";
import { highlightMatch } from "../lib/highlight";
import { useListKeyboardNav } from "../hooks/useListKeyboardNav";

interface Props {
  onOpenNote: (number: number, title: string) => void;
}

function HighlightText({ text, query }: { text: string; query: string }) {
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

export default function SearchPanel({ onOpenNote }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const { activeIndex, setActiveIndex, handleKeyDown: handleListKeyDown } = useListKeyboardNav({
    items: results,
    enabled: results.length > 0,
    onSelect: (n) => onOpenNote(n.number, n.title),
  });

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { notes } = await api.listNotes({ q: query.trim() });
        setResults(notes);
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    handleListKeyDown(e);
  }

  return (
    <div className="search-panel">
      <div className="panel-header">搜索</div>
      <input
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索标题、正文、标签..."
        autoFocus
      />
      {loading && <p className="panel-muted">搜索中...</p>}
      {!loading && query && results.length === 0 && (
        <p className="panel-muted">无结果</p>
      )}
      <div className="search-results">
        {results.map((n, i) => (
          <button
            key={n.number}
            type="button"
            className={`search-result ${i === activeIndex ? "active" : ""}`}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => onOpenNote(n.number, n.title)}
          >
            <div className="search-result-title">
              <HighlightText text={n.title} query={query} />
            </div>
            <div className="search-result-meta">
              #{n.number} · {n.folder}
              {n.tags.length > 0 && ` · ${n.tags.join(", ")}`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
