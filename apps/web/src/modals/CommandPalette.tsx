import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useListKeyboardNav } from "../hooks/useListKeyboardNav";

export interface Command {
  id: string;
  label: string;
  run: () => void;
}

interface Props {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}

export default function CommandPalette({ open, commands, onClose }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, filter]);

  const { activeIndex, setActiveIndex, handleKeyDown: handleListKeyDown } = useListKeyboardNav({
    items: filtered,
    enabled: open,
    onSelect: (cmd) => {
      cmd.run();
      setFilter("");
      onClose();
    },
    onEscape: onClose,
  });

  useEffect(() => {
    if (!open) setFilter("");
  }, [open]);

  if (!open) return null;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    handleListKeyDown(e);
  }

  return (
    <div className="modal-overlay cmd-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          className="cmd-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令..."
          autoFocus
        />
        <ul className="cmd-list">
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                type="button"
                className={i === activeIndex ? "active" : ""}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  cmd.run();
                  setFilter("");
                  onClose();
                }}
              >
                {cmd.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="panel-muted">无匹配命令</li>}
        </ul>
      </div>
    </div>
  );
}
