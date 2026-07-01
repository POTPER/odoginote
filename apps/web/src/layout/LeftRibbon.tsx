import type { ReactNode } from "react";
import type { SidebarPanel } from "../types/ui";

interface Props {
  active: SidebarPanel;
  settingsOpen?: boolean;
  onChange: (panel: SidebarPanel) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const items: { id: SidebarPanel; label: string; icon: ReactNode }[] = [
  {
    id: "explorer",
    label: "文件",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7v12a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "搜索",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
    ),
  },
  {
    id: "tags",
    label: "标签",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 12V8H6a2 2 0 010-4h7v4M6 20l6-6M6 16l6 6" />
      </svg>
    ),
  },
  {
    id: "todos",
    label: "待办",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="6" height="6" rx="1" />
        <path d="M5 8l1.5 1.5L9 6" />
        <path d="M13 8h8M13 12h8M13 16h8" />
      </svg>
    ),
  },
  {
    id: "graph",
    label: "图谱",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M8 6h8M7 8l4 9M17 8l-4 9" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "设置",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
];

export default function LeftRibbon({ active, settingsOpen, onChange, sidebarCollapsed, onToggleSidebar }: Props) {
  return (
    <nav className="left-ribbon">
      <button
        type="button"
        className={`ribbon-btn ribbon-toggle${sidebarCollapsed ? " collapsed" : ""}`}
        title={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}
        onClick={onToggleSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={sidebarCollapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
        </svg>
      </button>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ribbon-btn ${(item.id === "settings" ? settingsOpen : active === item.id) ? "active" : ""}`}
          title={item.label}
          onClick={() => onChange(item.id)}
        >
          <span className="ribbon-icon">{item.icon}</span>
        </button>
      ))}
    </nav>
  );
}
