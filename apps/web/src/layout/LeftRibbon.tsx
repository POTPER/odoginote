import type { SidebarPanel } from "@odoginote/shared";

interface Props {
  active: SidebarPanel;
  onChange: (panel: SidebarPanel) => void;
}

const items: { id: SidebarPanel; label: string; icon: string }[] = [
  { id: "explorer", label: "文件", icon: "📁" },
  { id: "search", label: "搜索", icon: "🔍" },
  { id: "tags", label: "标签", icon: "🏷" },
  { id: "graph", label: "图谱", icon: "🕸" },
  { id: "settings", label: "设置", icon: "⚙" },
];

export default function LeftRibbon({ active, onChange }: Props) {
  return (
    <nav className="left-ribbon">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ribbon-btn ${active === item.id ? "active" : ""}`}
          title={item.label}
          onClick={() => onChange(item.id)}
        >
          <span className="ribbon-icon">{item.icon}</span>
        </button>
      ))}
    </nav>
  );
}
