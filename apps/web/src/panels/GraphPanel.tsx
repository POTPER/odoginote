import type { GraphEdge, GraphNode } from "@odoginote/shared";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

const GRAPH_WARN_NODES = 200;

interface Props {
  onOpenNote: (number: number, title: string) => void;
}

export default function GraphPanel({ onOpenNote }: Props) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [positions, setPositions] = useState<Map<number, { x: number; y: number }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getGraph()
      .then((g) => {
        setNodes(g.nodes);
        setEdges(g.edges);
        const cx = 200;
        const cy = 180;
        const r = Math.min(160, 50 + g.nodes.length * 6);
        const pos = new Map<number, { x: number; y: number }>();
        g.nodes.forEach((n, i) => {
          const angle = (2 * Math.PI * i) / Math.max(g.nodes.length, 1);
          pos.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
        });
        setPositions(pos);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="graph-panel">
        <div className="panel-header">关系图谱</div>
        <p className="panel-muted">加载中...</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="graph-panel">
        <div className="panel-header">关系图谱</div>
        <p className="panel-muted">暂无笔记或链接。在笔记中使用 [[标题]] 创建链接。</p>
      </div>
    );
  }

  const viewH = Math.max(320, 80 + nodes.length * 4);

  return (
    <div className="graph-panel">
      <div className="panel-header">
        关系图谱
        <span className="graph-stats">
          {nodes.length} 节点 · {edges.length} 链接
        </span>
      </div>
      {nodes.length > GRAPH_WARN_NODES && (
        <p className="graph-warn">笔记较多，图谱已简化显示。建议使用搜索定位笔记。</p>
      )}
      <svg className="graph-svg" viewBox={`0 0 400 ${viewH}`}>
        {edges.map((e, i) => {
          const from = positions.get(e.source);
          const to = positions.get(e.target);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--border)"
              strokeWidth={1}
            />
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          return (
            <g
              key={n.id}
              className="graph-node"
              onClick={() => onOpenNote(n.id, n.title)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={p.x} cy={p.y} r={14} fill="var(--accent)" />
              <text x={p.x} y={p.y + 28} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
                {n.title.length > 12 ? n.title.slice(0, 11) + "…" : n.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
