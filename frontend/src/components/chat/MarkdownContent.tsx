import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Copy, Check } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="prose dark:prose-invert max-w-none prose-table leading-relaxed text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isInline = !match && !codeString.includes('\n');

            if (isInline) {
              return (
                <code className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 font-mono text-[0.9em] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <div className="relative group my-2.5 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <span className="font-mono uppercase tracking-wider text-[10px]">{match ? match[1] : 'code'}</span>
                  <button
                    onClick={() => handleCopy(codeString, Math.random())}
                    className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-[11px]"
                  >
                    {copiedIndex !== null ? (
                      <>
                        <Check className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                  <code {...props}>{children}</code>
                </pre>
              </div>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                <table className="w-full text-left border-collapse text-xs">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
                {children}
              </td>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-slate-900 dark:text-slate-100 underline underline-offset-2 hover:opacity-80"
              >
                {children}
              </a>
            );
          },
          p({ children }) {
            return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-4 mb-2.5 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 mb-2.5 space-y-1">{children}</ol>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-slate-400 dark:border-slate-600 pl-3 italic text-slate-500 my-2">
                {children}
              </blockquote>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
