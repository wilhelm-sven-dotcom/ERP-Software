import * as React from "react";

import { HelpTip } from "@/components/shared/help-tip";

export function PageHeader({
  title,
  description,
  helpId,
  children,
}: {
  title: string;
  description?: string;
  /** Optionaler Hilfe-Eintrag (zeigt ein (i) neben dem Titel). */
  helpId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-1.5 text-[1.7rem] font-semibold tracking-tight">
          {title}
          {helpId ? <HelpTip id={helpId} /> : null}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
