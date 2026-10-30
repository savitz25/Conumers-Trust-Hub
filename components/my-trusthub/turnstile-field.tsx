"use client";

import { useEffect, useRef, useState } from "react";
import { turnstileSizeForViewport } from "@/lib/my-trusthub/turnstile-layout";

declare global {
  interface Window { turnstile?: { render: (element: HTMLElement, options: { sitekey: string; theme?: string; size?: 'flexible' | 'compact'; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string; reset: (id: string) => void; remove: (id: string) => void }; }
}

export function TurnstileField({ siteKey, resetKey }: { siteKey: string; resetKey?: unknown }) {
  const host = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLInputElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState('Complete the security check.');
  useEffect(() => {
    if (!siteKey || !host.current) return;
    let generation = 0;
    const clear = (message: string) => { if (token.current) token.current.value = ''; setStatus(message); };
    const compactViewport = window.matchMedia('(max-width: 406px)');
    let compact = turnstileSizeForViewport(window.innerWidth) === 'compact';
    const render = () => {
      if (!host.current || !window.turnstile || widget.current) return;
      const renderGeneration = ++generation;
      const isCurrent = () => renderGeneration === generation;
      widget.current = window.turnstile.render(host.current, {
        sitekey: siteKey,
        theme: 'light',
        size: compact ? 'compact' : 'flexible',
        callback: value => {
          if (!isCurrent()) return;
          if (token.current) token.current.value = value;
          setStatus('Security check complete.');
        },
        'expired-callback': () => {
          if (isCurrent()) clear('Security check expired. Please try the check again.');
        },
        'error-callback': () => {
          if (isCurrent()) clear('Security check unavailable. Please retry or return later.');
        },
      });
    };
    const resize = () => {
      const nextCompact = turnstileSizeForViewport(window.innerWidth) === 'compact';
      if (nextCompact === compact) return;
      compact = nextCompact;
      // Invalidate callbacks before removing the old iframe. Turnstile may
      // still deliver a queued callback after remove() during a resize.
      generation += 1;
      const previousWidget = widget.current;
      widget.current = undefined;
      if (previousWidget) window.turnstile?.remove(previousWidget);
      clear('Complete a fresh security check.');
      render();
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-myth-turnstile]');
    const failed = () => clear('Security check could not load. Please reload or return later.');
    if (!script && !window.turnstile) { script = document.createElement('script'); script.dataset.mythTurnstile = 'true'; script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; document.head.appendChild(script); }
    script?.addEventListener('load', render); script?.addEventListener('error', failed); compactViewport.addEventListener('change', resize); render();
    return () => {
      script?.removeEventListener('load', render);
      script?.removeEventListener('error', failed);
      compactViewport.removeEventListener('change', resize);
      generation += 1;
      const previousWidget = widget.current;
      widget.current = undefined;
      if (previousWidget) window.turnstile?.remove(previousWidget);
    };
  }, [siteKey]);
  useEffect(() => { if (token.current) token.current.value = ''; if (widget.current) window.turnstile?.reset(widget.current); setStatus('Complete a fresh security check.'); }, [resetKey]);
  return <><div ref={host} aria-label="Security verification" /><input ref={token} type="hidden" name="captchaToken" /><p role="status">{status}</p><button type="button" className="myth-secondary" onClick={() => { if (token.current) token.current.value = ''; if (widget.current) window.turnstile?.reset(widget.current); setStatus('Complete a fresh security check.'); }}>Retry security check</button></>;
}
