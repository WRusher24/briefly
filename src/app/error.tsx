"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-xl font-semibold">Something went wrong</p>
      <p className="mt-2 text-sm text-muted">
        {error.digest ? `Reference: ${error.digest}. ` : ""}Please try again — if it keeps happening, check your database connection.
      </p>
      <button onClick={reset} className="btn-primary mt-6">
        Try again
      </button>
    </main>
  );
}
