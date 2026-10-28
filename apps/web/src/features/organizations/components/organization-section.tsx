import type { ReactNode } from 'react';

/** A section of the organization detail: a heading, a description and its content. */
export function OrganizationSection({
  id,
  title,
  description,
  tourTarget,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /** The `data-tour` value of the section (§2.4). */
  tourTarget?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} data-tour={tourTarget} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id={id} className="text-lg font-semibold">
          {title}
        </h3>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
