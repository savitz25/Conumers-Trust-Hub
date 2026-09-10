"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window { turnstile?: { render: (element: HTMLElement, options: { sitekey: string; theme?: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string; reset: (id: string) => void }; }
}

export function TurnstileField({ siteKey }: { siteKey: string }) {
  const host = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!siteKey || !host.current) return;
    let widget: string | undefined;
    const render = () => { if (!host.current || !window.turnstile || widget) return; widget = window.turnstile.render(host.current, { sitekey: siteKey, theme: "light", callback: (value) => { if (token.current) token.current.value = value; }, "expired-callback": () => { if (token.current) token.current.value = ""; }, "error-callback": () => { if (token.current) token.current.value = ""; } }); };
    if (window.turnstile) render(); else { const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.defer = true; script.addEventListener("load", render); document.head.appendChild(script); return () => script.removeEventListener("load", render); }
  }, [siteKey]);
  return <><div ref={host} aria-label="Security verification" /><input ref={token} type="hidden" name="captchaToken" /></>;
}
