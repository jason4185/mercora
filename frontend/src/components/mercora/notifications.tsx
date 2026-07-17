import { Bell, Check, AlertTriangle, X, Trophy, Coins } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOTIFICATIONS } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <button className="text-[12px] text-muted-foreground hover:text-foreground">
            Mark all read
          </button>
        </div>
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border scrollbar-thin">
          {NOTIFICATIONS.map((n) => {
            const Icon =
              n.kind === "won"
                ? Trophy
                : n.kind === "lost"
                  ? X
                  : n.kind === "inconclusive"
                    ? AlertTriangle
                    : n.kind === "cancelled"
                      ? AlertTriangle
                      : n.kind === "claimed"
                        ? Coins
                        : Check;
            const color =
              n.kind === "won"
                ? "text-up"
                : n.kind === "lost"
                  ? "text-down"
                  : n.kind === "inconclusive" || n.kind === "cancelled"
                    ? "text-warning"
                    : n.kind === "claimed"
                      ? "text-consensus"
                      : "text-muted-foreground";
            return (
              <div key={n.id} className={cn("flex items-start gap-3 px-3 py-3", n.unread && "bg-surface")}>
                <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2", color)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(n.ts, { addSuffix: true })}
                  </p>
                </div>
                {n.unread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </div>
            );
          })}
        </div>
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          Contract state is authoritative — notifications may lag on-chain events.
        </div>
      </PopoverContent>
    </Popover>
  );
}
