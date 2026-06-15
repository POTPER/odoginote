import type { NoteSummary } from "@odoginote/shared";
import { extractWikiLinks, resolveLink } from "@odoginote/shared";

interface Props {
  content: string;
  notes: NoteSummary[];
  onOpenNote?: (number: number, title: string) => void;
}

export default function OutgoingLinksPanel({ content, notes, onOpenNote }: Props) {
  const links = extractWikiLinks(content);
  const resolved = links
    .map((link) => {
      const num = resolveLink(link, notes);
      const note = num != null ? notes.find((n) => n.number === num) : null;
      return { link, num, title: note?.title ?? link };
    })
    .filter((item, i, arr) => arr.findIndex((x) => x.link === item.link) === i);

  if (resolved.length === 0) {
    return <p className="panel-muted">暂无出链</p>;
  }

  return (
    <div className="outgoing-links-panel">
      <span className="backlinks-label">出链 ({resolved.length})</span>
      <div className="backlinks-list">
        {resolved.map(({ link, num, title }) => (
          <button
            key={link}
            type="button"
            className={`backlink-item${num == null ? " unresolved" : ""}`}
            onClick={() => {
              if (num != null) onOpenNote?.(num, title);
            }}
            disabled={num == null}
          >
            {title}
          </button>
        ))}
      </div>
    </div>
  );
}
