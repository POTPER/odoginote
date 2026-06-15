import type { NoteSummary } from "@odoginote/shared";

interface Props {
  backlinks: NoteSummary[];
  onOpenNote?: (number: number, title: string) => void;
  compact?: boolean;
}

export default function BacklinksPanel({ backlinks, onOpenNote, compact }: Props) {
  if (backlinks.length === 0) {
    if (compact) return null;
    return <p className="panel-muted">暂无反向链接</p>;
  }

  return (
    <div className={`backlinks-panel${compact ? " compact" : ""}`}>
      <span className="backlinks-label">反向链接 ({backlinks.length})</span>
      <div className="backlinks-list">
        {backlinks.map((b) => (
          <button
            key={b.number}
            type="button"
            className="backlink-item"
            onClick={() => onOpenNote?.(b.number, b.title)}
          >
            {b.title}
          </button>
        ))}
      </div>
    </div>
  );
}
