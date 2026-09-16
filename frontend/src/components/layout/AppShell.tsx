'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/Sheet';
import { SessionExpiredDialog } from './SessionExpiredDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * Desktop: a full-viewport shell with a persistent sidebar and one scrolling content area (the warm
 * backdrop is reserved for the auth pages). Below 1024px the sidebar becomes a drawer and the page
 * scrolls normally (Frontend.md §13–17, §133).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="relative flex min-h-dvh bg-canvas lg:h-dvh lg:overflow-hidden">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-surface px-4 py-2 font-medium text-ink shadow-elevated focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border-subtle bg-surface lg:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        <TopBar onOpenNavigation={() => setNavOpen(true)} />
        {/* `relative` keeps absolutely positioned descendants (sr-only tables) inside the scroll area. */}
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="relative flex-1 px-4 py-6 outline-none sm:px-6 lg:overflow-y-auto lg:px-8 lg:py-7"
        >
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" title="Navigation" hideHeader className="lg:hidden">
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <SessionExpiredDialog />
    </div>
  );
}
