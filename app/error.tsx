"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-navy">This page is temporarily unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try again. Public research records were not changed by this error.
      </p>
      <button className="btn-primary mt-5" type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
