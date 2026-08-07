'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

type AskChatContextValue = {
  open: boolean;
  openChat: (opts?: { initialPrompt?: string }) => void;
  closeChat: () => void;
  toggleChat: () => void;
  /** Consumed once by the panel when opening with a prompt */
  takeInitialPrompt: () => string | null;
};

const AskChatContext = createContext<AskChatContextValue | null>(null);

export function AskChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const openChat = useCallback((opts?: { initialPrompt?: string }) => {
    const p = opts?.initialPrompt?.trim();
    if (p) setPendingPrompt(p);
    setOpen((wasOpen) => {
      if (!wasOpen) {
        trackEvent(ANALYTICS_EVENTS.CONCIERGE_OPEN, {
          has_prompt: Boolean(p),
        });
      }
      return true;
    });
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setOpen((v) => {
      if (!v) {
        trackEvent(ANALYTICS_EVENTS.CONCIERGE_OPEN, { has_prompt: false, via: 'toggle' });
      }
      return !v;
    });
  }, []);

  const takeInitialPrompt = useCallback(() => {
    const p = pendingPrompt;
    setPendingPrompt(null);
    return p;
  }, [pendingPrompt]);

  const value = useMemo(
    () => ({ open, openChat, closeChat, toggleChat, takeInitialPrompt }),
    [open, openChat, closeChat, toggleChat, takeInitialPrompt]
  );

  return <AskChatContext.Provider value={value}>{children}</AskChatContext.Provider>;
}

export function useAskChat(): AskChatContextValue {
  const ctx = useContext(AskChatContext);
  if (!ctx) {
    throw new Error('useAskChat must be used within AskChatProvider');
  }
  return ctx;
}
