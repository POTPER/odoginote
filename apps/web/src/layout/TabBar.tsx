import type { TabItem } from "../hooks/useAppState";
import { useState } from "react";

interface Props {
  tabs: TabItem[];
  activeNumber: number | null;
  onSelect: (number: number) => void;
  onClose: (number: number) => void;
  onNew: () => void;
  onTogglePin: (number: number) => void;
  onReorder: (from: number, to: number) => void;
  newNoteDisabled?: boolean;
}

export default function TabBar({
  tabs,
  activeNumber,
  onSelect,
  onClose,
  onNew,
  onTogglePin,
  onReorder,
  newNoteDisabled = false,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="tab-bar">
      {tabs.map((tab, index) => (
        <div
          key={tab.number}
          className={`tab-item ${activeNumber === tab.number ? "active" : ""} ${tab.pinned ? "pinned" : ""} ${dragIndex === index ? "dragging" : ""}`}
          draggable
          onClick={() => onSelect(tab.number)}
          onMouseDown={(e) => {
            if (e.button === 1 && !tab.pinned) {
              e.preventDefault();
              onClose(tab.number);
            }
          }}
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex != null && dragIndex !== index) onReorder(dragIndex, index);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
        >
          {tab.pinned && <span className="tab-pin-icon">📌</span>}
          <span className="tab-title">{tab.title || "Untitled"}</span>
          <button
            type="button"
            className="tab-pin"
            title={tab.pinned ? "取消固定" : "固定标签"}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(tab.number);
            }}
          >
            {tab.pinned ? "📌" : "📍"}
          </button>
          <button
            type="button"
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.number);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="tab-new"
        onClick={onNew}
        disabled={newNoteDisabled}
        title="新建笔记"
      >
        +
      </button>
    </div>
  );
}
