import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="mt-3 text-muted">That page doesn’t exist or you don’t have access to it.</p>
      <Link href="/briefing/markets" className="btn-primary mt-6">
        Back to your briefing
      </Link>
    </main>
  );
}
