import type { NoteSummary } from "@odoginote/shared";

interface Props {
  items: NoteSummary[];
  activeIndex: number;
  onSelect: (title: string) => void;
}

export default function WikiLinkSuggest({ items, activeIndex, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="wiki-suggest">
        <div className="wiki-suggest-empty">无匹配笔记（Enter 创建新链接）</div>
      </div>
    );
  }

  return (
    <ul className="wiki-suggest">
      {items.map((item, i) => (
        <li key={item.number}>
          <button
            type="button"
            className={i === activeIndex ? "active" : ""}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.title);
            }}
          >
            <span className="wiki-suggest-title">{item.title}</span>
            <span className="wiki-suggest-meta">#{item.number}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
