import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { MercoraLogo } from "./logo";
import { WalletButton } from "./wallet-button";
import { NotificationsBell } from "./notifications";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useWallet } from "@/lib/wallet-context";

const NAV = [
  { to: "/", label: "Markets" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/docs", label: "Documentation" },
];

export function TopNav() {
  const [open, setOpen] = useState(false);
  const [authorizationEnabled, setAuthorizationEnabled] = useState(false);
  const { isAdmin, authorizationLoading } = useWallet({
    authorization: authorizationEnabled,
    balance: false,
  });
  useEffect(() => {
    const timeout = window.setTimeout(() => setAuthorizationEnabled(true), 8_000);
    return () => window.clearTimeout(timeout);
  }, []);
  const links = isAdmin && !authorizationLoading ? [...NAV, { to: "/admin", label: "Admin" }] : NAV;
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-background/88 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl">
      <div className="mx-auto flex h-15 max-w-[1480px] items-center gap-5 px-4 md:px-6">
        <Link to="/" className="shrink-0">
          <MercoraLogo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="relative rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
              activeProps={{
                className:
                  "bg-primary/10 text-foreground after:absolute after:inset-x-3 after:-bottom-[10px] after:h-px after:bg-primary",
              }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationsBell />
          <WalletButton />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Menu"
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="p-4 border-b border-border">
                <MercoraLogo />
              </div>
              <nav className="flex flex-col p-2">
                {links.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
                    activeProps={{ className: "bg-surface text-foreground" }}
                    activeOptions={{ exact: n.to === "/" }}
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
