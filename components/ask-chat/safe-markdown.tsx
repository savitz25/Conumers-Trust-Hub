import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { safeConciergeUrl } from '@/lib/ai/safe-markdown';

export function SafeConciergeMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('space-y-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-[#4F46E5] [&_a]:underline [&_a]:underline-offset-2', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeConciergeUrl}
        components={{
          a: ({ href, children, ...props }) => {
            const safe = href ? safeConciergeUrl(href) : '';
            if (!safe) return <span>{children}</span>;
            const external = /^https?:\/\//i.test(safe);
            return <a {...props} href={safe} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{children}</a>;
          },
          p: ({ children }) => <p>{children}</p>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
