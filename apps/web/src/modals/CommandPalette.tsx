import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

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
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, filter]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filter, open]);

  useEffect(() => {
    if (!open) setFilter("");
  }, [open]);

  if (!open) return null;

  function run(cmd: Command) {
    cmd.run();
    setFilter("");
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      run(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
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
                onClick={() => run(cmd)}
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
