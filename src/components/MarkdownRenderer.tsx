import { memo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '../lib/clipboard';

interface MarkdownRendererProps {
  content: string;
}

function isSafeHref(href?: string): boolean {
  if (!href) return false;
  const trimmed = href.trim().toLowerCase();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:')
  );
}

function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const el = node as { props?: { children?: ReactNode } };
    return extractTextContent(el.props?.children);
  }
  return '';
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const langMatch = /language-([a-zA-Z0-9_-]+)/.exec(className || '');
  const language = langMatch ? langMatch[1] : 'code';
  const rawCode = extractTextContent(children).replace(/\n$/, '');

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(rawCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-[#070B14]">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-200/60 dark:bg-white/[0.03]">
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 select-none">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="agm-press min-h-[32px] px-2 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-emerald-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.06] cursor-pointer"
          aria-label="Copy code snippet"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3.5 text-[13px] leading-relaxed font-mono">
        <code className={className}>{children}</code>
      </div>
    </div>
  );
}

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose-agm text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 break-words">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold mt-5 mb-2.5 text-slate-900 dark:text-white tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-4 mb-2 text-slate-900 dark:text-white tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-3.5 mb-1.5 text-slate-900 dark:text-white">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.03] px-4 py-2.5 text-slate-700 dark:text-slate-300">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-slate-200 dark:border-white/10" />,
          a: ({ href, children }) =>
            isSafeHref(href) ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-500 dark:hover:text-emerald-300"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10 text-left">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(
              className && (className.includes('language-') || className.includes('hljs'))
            );
            const textStr = extractTextContent(children);
            const hasNewline = textStr.includes('\n');
            if (isBlock || hasNewline) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-white/10 text-emerald-700 dark:text-emerald-300 text-[13px] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
