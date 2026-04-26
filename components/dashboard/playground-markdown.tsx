'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

// Markdown renderer for assistant text. Renders inline on the pane background
//, no bordered wrapper, so the response sits next to the tool-call log
// like terminal output, not boxed-in commentary. The pane Card already
// provides the bounding chrome.

type Props = {
  text: string;
  className?: string;
};

export const PlaygroundMarkdown = ({ text, className }: Props) => (
  <div className={cn('text-sm leading-relaxed', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mt-3 mb-1 text-base font-semibold">{children}</h1>,
        h2: ({ children }) => <h2 className="mt-3 mb-1 text-sm font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-2 mb-0.5 text-sm font-semibold">{children}</h3>,
        p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className: cls }) => {
          const isInline = !cls;
          if (isInline) {
            return (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{children}</code>
            );
          }
          return <code className={cn('font-mono text-[12px]', cls)}>{children}</code>;
        },
        pre: ({ children }) => (
          <pre className="scrollbar-dark my-2 overflow-x-auto rounded-md border bg-muted/40 p-2 text-[12px]">
            {children}
          </pre>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-2 border-border" />,
        table: ({ children }) => (
          <div className="scrollbar-dark my-2 overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
);
