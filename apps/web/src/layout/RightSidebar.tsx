import type { NoteSummary } from "@odoginote/shared";
import { findBacklinks } from "@odoginote/shared";
import type { RightPanelTab } from "../hooks/useLayoutState";
import OutlinePanel from "../panels/OutlinePanel";
import BacklinksPanel from "../panels/BacklinksPanel";
import OutgoingLinksPanel from "../panels/OutgoingLinksPanel";
import PaneResizer from "../components/PaneResizer";

interface Props {
  panel: RightPanelTab;
  onPanelChange: (panel: RightPanelTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  content: string;
  noteTitle: string;
  noteNumber: number;
  notes: NoteSummary[];
  onJump: (line: number) => void;
  onOpenNote: (number: number, title: string) => void;
  onResize: (delta: number) => void;
}

const TABS: { id: RightPanelTab; label: string }[] = [
  { id: "outline", label: "大纲" },
  { id: "backlinks", label: "反向链接" },
  { id: "outgoing", label: "出链" },
];

export default function RightSidebar({
  panel,
  onPanelChange,
  collapsed,
  onToggleCollapse,
  content,
  noteTitle,
  noteNumber,
  notes,
  onJump,
  onOpenNote,
  onResize,
}: Props) {
  const backlinks = findBacklinks(noteTitle, noteNumber, notes);

  if (collapsed) {
    return (
      <aside className="right-sidebar collapsed">
        <button type="button" className="right-sidebar-expand" title="展开右侧面板" onClick={onToggleCollapse}>
          ◀
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-sidebar">
      <PaneResizer onResize={onResize} />
      <div className="right-sidebar-header">
        <div className="right-sidebar-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`right-sidebar-tab${panel === t.id ? " active" : ""}`}
              onClick={() => onPanelChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="right-sidebar-collapse" title="折叠右侧面板" onClick={onToggleCollapse}>
          ▶
        </button>
      </div>
      <div className="right-sidebar-body">
        {panel === "outline" && <OutlinePanel content={content} onJump={onJump} embedded />}
        {panel === "backlinks" && <BacklinksPanel backlinks={backlinks} onOpenNote={onOpenNote} />}
        {panel === "outgoing" && (
          <OutgoingLinksPanel content={content} notes={notes} onOpenNote={onOpenNote} />
        )}
      </div>
    </aside>
  );
}
