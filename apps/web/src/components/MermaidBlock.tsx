import { useEffect, useId, useRef, useState } from "react";

interface Props {
  chart: string;
  theme?: "light" | "dark";
}

export default function MermaidBlock({ chart, theme = "dark" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const renderId = `mermaid-${reactId.replace(/:/g, "")}`;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    container.innerHTML = "";
    setError(null);

    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "strict",
        });
        const { svg } = await mermaid.render(renderId, chart.trim() || "graph TD\n  A[Empty]");
        if (!cancelled) container.innerHTML = svg;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Mermaid 渲染失败");
        }
      }
    })();

    return () => {
      cancelled = true;
      container.innerHTML = "";
    };
  }, [chart, theme, renderId]);

  if (error) {
    return <pre className="mermaid-error">{error}</pre>;
  }

  return <div ref={containerRef} className="mermaid-block" data-mermaid />;
}
