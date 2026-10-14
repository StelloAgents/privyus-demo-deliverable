import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/*
 * Code text for the technical page. Monospace is used only for code
 * (queries, JSON, schema identifiers), never for labels or metadata.
 */

export const MONO = "font-mono text-[12.5px] leading-[20px]";

const SQL_KEYWORDS = new Set(["WHERE", "AND", "IN", "JOIN", "ORDER", "BY", "SELECT", "FROM"]);

/** A tiny highlighter for the one-hop query notation: keywords, comments, and table names. */
export function SqlText({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <>
      {lines.map((line, li) => {
        const [body, comment] = splitComment(line);
        const parts = body.split(/(\s+|[(),=.])/);
        return (
          <span key={li} className="block whitespace-pre">
            {parts.map((p, i) => {
              if (!p) return null;
              if (SQL_KEYWORDS.has(p)) return <span key={i} className="text-teal-bright">{p}</span>;
              if (i === 0 && li === 0) return <span key={i} className="font-semibold text-fg-1">{p}</span>;
              if (p === "entities" || p === "documents" || p === "edges" || p === "entity_stats")
                return <span key={i} className="font-semibold text-fg-1">{p}</span>;
              return <span key={i} className="text-fg-2">{p}</span>;
            })}
            {comment ? <span className="text-fg-3">{comment}</span> : null}
          </span>
        );
      })}
    </>
  );
}

function splitComment(line: string): [string, string | null] {
  const i = line.indexOf("--");
  if (i < 0) return [line, null];
  return [line.slice(0, i), line.slice(i)];
}

/** A tiny JSON highlighter: keys, strings, comments. Good enough for the fixed examples. */
export function JsonText({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <>
      {lines.map((line, li) => {
        if (line.trimStart().startsWith("//")) {
          return (
            <span key={li} className="block whitespace-pre text-fg-3">
              {line}
            </span>
          );
        }
        const out: ReactNode[] = [];
        const re = /"(?:[^"\\]|\\.)*"(\s*:)?/g;
        let last = 0;
        let m: RegExpExecArray | null;
        let k = 0;
        while ((m = re.exec(line))) {
          if (m.index > last) out.push(<span key={k++} className="text-fg-3">{line.slice(last, m.index)}</span>);
          const isKey = Boolean(m[1]);
          const str = isKey ? m[0].slice(0, m[0].length - m[1].length) : m[0];
          out.push(
            <span key={k++} className={isKey ? "text-teal-bright" : "text-fg-1"}>
              {str}
            </span>,
          );
          if (isKey) out.push(<span key={k++} className="text-fg-3">{m[1]}</span>);
          last = m.index + m[0].length;
        }
        if (last < line.length) out.push(<span key={k++} className="text-fg-3">{line.slice(last)}</span>);
        return (
          <span key={li} className="block min-h-[20px] whitespace-pre">
            {out}
          </span>
        );
      })}
    </>
  );
}

/** A code panel with a small title row. Scrolls inside itself on narrow widths. */
export function CodeBlock({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cx("flex min-w-0 flex-col rounded-card border border-line bg-surface-2", className)}>
      <figcaption className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <span className="text-[13px] leading-4 font-medium text-fg-1">{title}</span>
        {meta ? <span className="t-meta">{meta}</span> : null}
      </figcaption>
      <pre className={cx(MONO, "min-w-0 flex-1 overflow-x-auto px-4 py-3")}>
        <code>{children}</code>
      </pre>
    </figure>
  );
}
