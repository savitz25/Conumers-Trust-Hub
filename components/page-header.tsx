import { ASK_BRAND } from '@/lib/design/ask-design-system';

interface PageHeaderProps {
  label?: string;
  title: string;
  description?: string;
}

export function PageHeader({ label, title, description }: PageHeaderProps) {
  return (
    <header
      className="border-b"
      style={{
        borderColor: ASK_BRAND.border,
        backgroundColor: ASK_BRAND.canvas,
      }}
    >
      <div className="container-page py-12 sm:py-14 lg:py-16">
        {label ? (
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            {label}
          </p>
        ) : null}
        <h1
          className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight"
          style={{ color: ASK_BRAND.navy }}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="mt-4 max-w-2xl text-lg leading-relaxed"
            style={{ color: ASK_BRAND.ink }}
          >
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}
