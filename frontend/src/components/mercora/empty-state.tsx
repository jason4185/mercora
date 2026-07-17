import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  to = "/",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  to?: "/";
}) {
  const button = (
    <button
      onClick={onAction}
      className="mt-4 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground"
    >
      {actionLabel}
    </button>
  );
  return (
    <div className="card-elevated grid min-h-56 place-items-center rounded-xl p-8 text-center">
      <div>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
        {onAction ? (
          button
        ) : (
          <Link
            to={to}
            className="mt-4 inline-flex rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
