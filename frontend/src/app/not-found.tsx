import { SearchX } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-ink-faint">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">This page doesn&apos;t exist or has moved.</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-10 items-center rounded-control bg-primary-strong px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-strong-hover"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
