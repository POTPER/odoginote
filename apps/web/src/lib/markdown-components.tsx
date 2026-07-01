import {
  Children,
  createElement,
  isValidElement,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import { extractHeadings, resolveLink, type NoteSummary } from "@odoginote/shared";
import PreviewImage from "../components/PreviewImage";
import MermaidBlock from "../components/MermaidBlock";

function isMermaidChild(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  if (child.type === MermaidBlock) return true;
  if (child.props && typeof child.props === "object" && "data-mermaid" in child.props) {
    return true;
  }
  return false;
}

function mermaidCodeBlock(chart: string, theme: "light" | "dark") {
  return <MermaidBlock chart={chart} theme={theme} />;
}

function buildCodeHandlers(theme: "light" | "dark"): Pick<Components, "code" | "pre"> {
  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const value = String(children).replace(/\n$/, "");
      if (match?.[1] === "mermaid") {
        return mermaidCodeBlock(value, theme);
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children, ...props }) {
      const child = Children.toArray(children)[0];
      if (isMermaidChild(child)) {
        return <>{child}</>;
      }
      return <pre {...props}>{children}</pre>;
    },
  };
}

export interface NoteMarkdownOptions {
  content: string;
  theme: "light" | "dark";
  notes: NoteSummary[];
  linkMode: "editor" | "reader";
  onNeedGitHubSession?: () => void;
  onOpenWikiLink: (target: string) => void;
}

export function createNoteMarkdownComponents({
  content,
  theme,
  notes,
  linkMode,
  onNeedGitHubSession,
  onOpenWikiLink,
}: NoteMarkdownOptions): Components {
  let idx = 0;
  const list = extractHeadings(content);
  const mk = (level: 1 | 2 | 3 | 4 | 5 | 6): Components[`h${typeof level}`] => {
    return ({ children, ...props }) => {
      const h = list[idx++];
      return createElement(`h${level}`, { id: h ? `heading-${h.slug}` : undefined, ...props }, children);
    };
  };

  return {
    h1: mk(1),
    h2: mk(2),
    h3: mk(3),
    h4: mk(4),
    h5: mk(5),
    h6: mk(6),
    img: ({ src, alt }) => (
      <PreviewImage src={src} alt={alt} onNeedGitHubSession={onNeedGitHubSession} />
    ),
    a: ({ href, children }) => {
      if (href?.startsWith("wiki:")) {
        const linkTarget = href.slice(5);
        const unresolved = resolveLink(linkTarget, notes) == null;
        return (
          <a
            href={href}
            className={`wiki-link${unresolved ? " unresolved" : ""}`}
            title={
              linkMode === "editor"
                ? unresolved
                  ? "点击创建笔记"
                  : "点击打开笔记"
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              onOpenWikiLink(linkTarget);
            }}
          >
            {children}
          </a>
        );
      }
      if (href && /^https?:\/\//.test(href)) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }
      return <a href={href}>{children}</a>;
    },
    ...buildCodeHandlers(theme),
  };
}

export function createNotebookMarkdownComponents(theme: "light" | "dark"): Components {
  return buildCodeHandlers(theme);
}
