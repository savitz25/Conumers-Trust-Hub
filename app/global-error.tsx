"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
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
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="mx-auto max-w-xl px-4 py-16">
          <h1 className="text-2xl font-semibold text-navy">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask Trust Hub could not finish this request. Your private research was not changed.
          </p>
          <button className="btn-primary mt-5" type="button" onClick={() => reset()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
