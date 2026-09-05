'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { AiConciergeDisclosure } from '@/components/ask-chat/ai-disclosure';
import { SafeConciergeMarkdown } from '@/components/ask-chat/safe-markdown';
import { useAskChat } from '@/components/ask-chat/ask-chat-context';
import { ASK_CONCIERGE_WELCOME } from '@/lib/ai/system-prompt';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { cn } from '@/lib/utils';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  allowedUrls?:string[];
  actions?:Array<{id:string;label:string;href:string;owner?:string}>;
  pending?:boolean;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Slide-over Concierge chat — desktop right panel, mobile full-screen sheet.
 */
export function AskChatPanel() {
  const { open, closeChat, takeInitialPrompt } = useAskChat();
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: 'welcome', role: 'assistant', content: ASK_CONCIERGE_WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const abortRef=useRef<AbortController|null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    abortRef.current?.abort();
    const controller=new AbortController();abortRef.current=controller;
    const started=performance.now();
    sendingRef.current = true;
    setError(null);
    setInput('');
    trackEvent(ANALYTICS_EVENTS.CONCIERGE_SUBMIT, {
      length: Math.min(text.length, 2000),
    });

    const userMsg: UiMessage = { id: newId(), role: 'user', content: text };
    const prior = messagesRef.current.filter(message=>!message.pending);
    const nextHistory = [...prior, userMsg];
    setMessages(nextHistory);
    setLoading(true);
    const researchHref=`/ask?q=${encodeURIComponent(text)}`;
    const pendingId=newId();
    setMessages(prev=>[...prev.filter(message=>!message.pending),{id:pendingId,role:'assistant',content:'I understood your question. The source-backed research route is ready while I prepare an explanation.',allowedUrls:[researchHref],actions:[{id:'open-research',label:'Open source-backed research',href:researchHref}],pending:true}]);
    trackEvent(ANALYTICS_EVENTS.CONCIERGE_FIRST_CONTENT,{duration_ms:Math.round(performance.now()-started),length:Math.min(text.length,2000)});

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal:controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        message?: { content?: string };
        error?: string;
        route?:{destinations?:Array<{id:string;label:string;href:string;owner?:string}>;researchHref?:string};
      };

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      const reply = data.message?.content?.trim();
      if (!reply) throw new Error('Empty reply');

      setMessages((prev) => prev.map(message=>message.id===pendingId?{...message,content:reply,pending:false,allowedUrls:[...(data.route?.destinations??[]).map(d=>d.href),...(data.route?.researchHref?[data.route.researchHref]:[])],actions:[...(data.route?.destinations??[]),...(data.route?.researchHref?[{id:'open-research',label:'Open source-backed research',href:data.route.researchHref}]:[])]}:message));
      trackEvent(ANALYTICS_EVENTS.CONCIERGE_COMPLETE,{duration_ms:Math.round(performance.now()-started),length:Math.min(text.length,2000)});
    } catch (e) {
      if(e instanceof DOMException&&e.name==='AbortError')return;
      const msg =
        e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content:
            'I could not complete that explanation just now. The source-backed research action above remains available.',
        },
      ]);
    } finally {
      setLoading(false);
      if(abortRef.current===controller){sendingRef.current = false;abortRef.current=null;}
    }
  }, []);

  useEffect(()=>()=>abortRef.current?.abort(),[]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    const pending = takeInitialPrompt();
    if (pending) {
      void sendMessage(pending);
    }
    return () => {window.clearTimeout(focusTimer);abortRef.current?.abort();};
  }, [open, takeInitialPrompt, sendMessage]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeChat();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeChat]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="absolute inset-0 bg-[#0A2540]/40 backdrop-blur-[2px]"
        aria-label="Close chat"
        onClick={closeChat}
      />

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex h-[min(92dvh,100%)] max-h-[100dvh] flex-col bg-white',
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-full sm:max-w-md sm:border-l'
        )}
        style={{
          borderColor: ASK_BRAND.border,
          boxShadow: ASK_SHADOW.card,
        }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
          style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: ASK_BRAND.indigo }}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2
                id={titleId}
                className="text-sm font-semibold tracking-tight sm:text-base"
                style={{ color: ASK_BRAND.navy }}
              >
                AI Concierge
              </h2>
              <p className="text-[11px] font-medium" style={{ color: ASK_BRAND.indigo }}>
                We cite. You decide.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeChat}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl transition-colors hover:bg-white"
            style={{ color: ASK_BRAND.navy }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="border-b px-4 py-2.5 sm:px-5"
          style={{ borderColor: ASK_BRAND.border, backgroundColor: '#EEF2FF' }}
        >
          <AiConciergeDisclosure compact />
        </div>

        <div
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
          style={{ backgroundColor: ASK_BRAND.white }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                  m.role === 'user' ? 'text-white' : 'border'
                )}
                style={
                  m.role === 'user'
                    ? { backgroundColor: ASK_BRAND.indigo }
                    : {
                        backgroundColor: ASK_BRAND.canvas,
                        borderColor: ASK_BRAND.border,
                        color: ASK_BRAND.ink,
                      }
                }
              >
                {m.role === 'assistant' ? <><SafeConciergeMarkdown content={m.content} allowedUrls={m.allowedUrls}/>{m.actions?.length?<div className="mt-2 flex flex-wrap gap-2">{m.actions.slice(0,3).map(a=><a key={a.id} href={a.href} className="inline-flex min-h-10 items-center rounded-lg border px-3 font-semibold text-[#4F46E5]">{a.owner==='OFFICIAL'?'Official source — ':''}{a.label}</a>)}</div>:null}</> : m.content}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: ASK_BRAND.ink }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: ASK_BRAND.indigo }} />
              Thinking…
            </div>
          ) : null}
          {error ? (
            <p className="text-xs" style={{ color: '#B91C1C' }} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <form
          className="border-t p-3 sm:p-4"
          style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <div className="flex items-end gap-2">
            <label htmlFor="ask-chat-input" className="sr-only">
              Message the Concierge
            </label>
            <textarea
              id="ask-chat-input"
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Ask about moving, lending, insurance…"
              disabled={loading}
              className="min-h-11 flex-1 resize-none rounded-xl border bg-white px-3 py-2.5 text-base leading-snug focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 disabled:opacity-60 sm:text-sm"
              style={{
                borderColor: ASK_BRAND.border,
                color: ASK_BRAND.ink,
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 disabled:opacity-50"
              style={{ backgroundColor: ASK_BRAND.indigo }}
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            <AiConciergeDisclosure compact />
            <p className="text-[11px] leading-snug" style={{ color: ASK_BRAND.ink }}>
              Guidance only — not legal, financial, or medical advice. No paid placements.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
