import { Fragment } from "react";

/** Minimal, safe markdown renderer (headings, bullets, bold, italics). */
export function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("_") && part.endsWith("_") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : <Fragment key={i}>{part}</Fragment>,
    );
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (/^#\s/.test(line)) return <h2 key={i} className="pt-2 text-lg font-semibold">{inline(line.replace(/^#\s/, ""))}</h2>;
        if (/^##+\s/.test(line)) return <h3 key={i} className="pt-2 font-semibold">{inline(line.replace(/^##+\s/, ""))}</h3>;
        if (/^\s*[-*]\s/.test(line)) return <div key={i} className="flex gap-2 pl-2"><span>•</span><span>{inline(line.replace(/^\s*[-*]\s/, ""))}</span></div>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}
