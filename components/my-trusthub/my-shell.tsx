import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bookmark,
  FolderKanban,
  Home,
  Radar,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { signOutAction } from "@/app/my/actions";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";

const nav = [
  ["Home", "/my", Home],
  ["Projects", "/my/projects", FolderKanban],
  ["Saved", "/my/saved", Bookmark],
  ["Watches", "/my/watches", Radar],
  ["You", "/my/you", UserRound],
] as const;

export function MyTrustHubShell({
  children,
  active,
  email,
}: {
  children: ReactNode;
  active: (typeof nav)[number][0];
  email: string;
}) {
  const visibleNav = nav.filter(([label]) => label !== "Watches" || isMyTrustHubFeatureEnabled("MY_TRUSTHUB_WATCH_ENABLED"));
  return (
    <div className="myth-app">
      <a className="myth-skip" href="#myth-content">Skip to content</a>
      <header className="myth-header">
        <div className="myth-header-inner">
          <Link className="myth-brand" href="/my" aria-label="My TrustHub home">
            <ShieldCheck aria-hidden="true" size={24} />
            <span>My TrustHub</span>
          </Link>
          <nav className="myth-desktop-nav" aria-label="My TrustHub">
            {visibleNav.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={active === label ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction} className="myth-account">
            <span title={email}>{email}</span>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <div id="myth-content" className="myth-main" tabIndex={-1}>{children}</div>
      <nav className="myth-mobile-nav" aria-label="My TrustHub mobile navigation">
        {visibleNav.map(([label, href, Icon]) => (
          <Link
            key={href}
            href={href}
            aria-current={active === label ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={19} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function MyTrustHubEmpty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="myth-empty">
      <ShieldCheck aria-hidden="true" size={30} />
      <h2>{title}</h2>
      <div>{children}</div>
      {action ? <div className="myth-empty-action">{action}</div> : null}
    </section>
  );
}

export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="myth-page-heading">
      <div>
        <p className="myth-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {action}
    </header>
  );
}
