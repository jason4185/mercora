import type { ReactNode } from "react";
import { TopNav } from "./top-nav";
import { Toaster } from "@/components/ui/sonner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-2 px-4 py-5 text-[12px] text-muted-foreground md:flex-row md:items-center md:px-6">
          <p>
            Mercora — hourly crypto direction markets, secured by GenLayer independent-validator consensus.
          </p>
          <p className="text-mono">Preview build · mocked data</p>
        </div>
      </footer>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
}
