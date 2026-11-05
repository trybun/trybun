import type { ReactNode } from 'react';

/** A state of the acceptance page that ends the flow or needs the person's action (ADR 0009). */
export function InvitationMessage({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  /** A button that continues, e.g. Sign out or Try again. */
  action?: ReactNode;
}) {
  return (
    <section role="alert" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children !== undefined && <p className="text-muted-foreground">{children}</p>}
      {action}
    </section>
  );
}
