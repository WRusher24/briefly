import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <Logo size={34} />
        <p className="mt-4 text-2xl font-semibold leading-tight tracking-tight">Read less. Know more.</p>
        <p className="mt-2 text-sm text-muted">
          Markets, Sports and Geopolitics — filtered, summarised and explained in three tiers.
        </p>
      </div>
      <div className="card p-5 sm:p-6">{children}</div>
    </main>
  );
}
