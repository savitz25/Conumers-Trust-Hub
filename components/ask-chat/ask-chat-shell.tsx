'use client';

import { AskChatProvider } from '@/components/ask-chat/ask-chat-context';
import { AskChatPanel } from '@/components/ask-chat/ask-chat-panel';
import type { ReactNode } from 'react';

export function AskChatShell({ children }: { children: ReactNode }) {
  return (
    <AskChatProvider>
      {children}
      <AskChatPanel />
    </AskChatProvider>
  );
}
