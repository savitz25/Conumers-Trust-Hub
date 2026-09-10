"use client";

export default function MyTrustHubError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="myth-auth-page">
      <section className="myth-auth-card" role="alert">
        <p className="myth-eyebrow">MY TRUSTHUB</p>
        <h1>Your workspace is temporarily unavailable</h1>
        <p>Your private research was not changed. Please try this request again.</p>
        <button className="myth-primary" type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
