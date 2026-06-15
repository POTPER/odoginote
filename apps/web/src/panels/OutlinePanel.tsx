import { extractHeadings } from "@odoginote/shared";

interface Props {
  content: string;
  onJump: (line: number) => void;
  embedded?: boolean;
}

export default function OutlinePanel({ content, onJump, embedded }: Props) {
  const headings = extractHeadings(content);

  const body =
    headings.length === 0 ? (
      <p className="panel-muted">使用 # 标题语法生成大纲</p>
    ) : (
      <ul className="outline-list">
        {headings.map((h) => (
          <li key={`${h.line}-${h.slug}`} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
            <button type="button" className="outline-item" onClick={() => onJump(h.line)}>
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    );

  if (embedded) return body;

  return (
    <aside className="outline-panel">
      <div className="panel-header">大纲</div>
      {body}
    </aside>
  );
}
