import { useCallback, useEffect, useRef } from "react";

interface Props {
  onResize: (delta: number) => void;
}

export default function PaneResizer({ onResize }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    },
    [onResize]
  );

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.classList.remove("pane-resizing");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.classList.add("pane-resizing");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove]);

  return (
    <div
      className="pane-resizer"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
    />
  );
}
