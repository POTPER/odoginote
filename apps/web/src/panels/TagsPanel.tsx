import { useMemo, useState } from "react";
import type { NoteSummary } from "@odoginote/shared";
import { aggregateTags } from "@odoginote/shared";

interface Props {
  notes: NoteSummary[];
  onOpenNote: (number: number, title: string) => void;
}

export default function TagsPanel({ notes, onOpenNote }: Props) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tagMap = useMemo(() => aggregateTags(notes), [notes]);
  const sortedTags = useMemo(
    () => [...tagMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [tagMap]
  );

  const taggedNotes = useMemo(() => {
    if (!activeTag) return [];
    return notes
      .filter((n) => n.tags.includes(activeTag))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [notes, activeTag]);

  return (
    <div className="tags-panel">
      <div className="panel-header">标签</div>

      {sortedTags.length === 0 ? (
        <p className="panel-muted">暂无标签。在笔记元信息中添加标签。</p>
      ) : (
        <ul className="tag-list">
          {sortedTags.map(([tag, count]) => (
            <li key={tag}>
              <button
                type="button"
                className={`tag-chip ${activeTag === tag ? "active" : ""}`}
                onClick={() => setActiveTag((t) => (t === tag ? null : tag))}
              >
                <span className="tag-name">#{tag}</span>
                <span className="tag-count">{count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {activeTag && (
        <div className="tag-notes">
          <div className="tag-notes-header">
            <span>#{activeTag}</span>
            <button type="button" className="link-btn" onClick={() => setActiveTag(null)}>
              清除
            </button>
          </div>
          <ul className="search-results">
            {taggedNotes.map((n) => (
              <li key={n.number}>
                <button type="button" className="search-result" onClick={() => onOpenNote(n.number, n.title)}>
                  <span className="search-result-title">{n.title}</span>
                  <span className="search-result-meta">{n.folder}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
