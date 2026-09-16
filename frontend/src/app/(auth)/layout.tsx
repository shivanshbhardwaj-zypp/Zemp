import { Logo } from '@/components/brand/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="warm-backdrop flex min-h-dvh items-center justify-center px-4 py-10">
      <main className="w-full max-w-[420px] rounded-2xl bg-surface p-8 shadow-modal sm:p-10">
        <Logo className="mb-8" />
        {children}
      </main>
    </div>
  );
}
