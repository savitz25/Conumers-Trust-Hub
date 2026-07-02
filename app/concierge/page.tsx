'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const SUGGESTED_PROMPTS = [
  'What should I do 30 days before moving?',
  'How does moving affect my mortgage?',
  'Do I get a health insurance SEP when I relocate?',
  'How do I verify a mover\'s FMCSA license?',
];

const WELCOME_MESSAGE = {
  role: 'assistant' as const,
  content: "Hey! I'm your relocation coach ✨ Ask me anything about moving, insurance, or lending — I'll point you to verified tools and keep things stress-free.",
};

type Message = { role: 'user' | 'assistant'; content: string };

/** AI Concierge skeleton — V1 will wire Vercel AI SDK + RAG */
export default function ConciergePage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    // Skeleton response — replace with /api/concierge in V1
    await new Promise((r) => setTimeout(r, 800));
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content: `Great question! For "${text.slice(0, 40)}...", I'd start with your master checklist and the relevant hub tools. This is a preview — full AI responses launch in V1. Try /moving/calculator or /lending/calculators while I learn your preferences!`,
      },
    ]);
    setLoading(false);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-fun" />
          AI Relocation Concierge
        </h1>
        <p className="text-muted-foreground mt-1">Your friendly move coach — here 24/7.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_240px] gap-6">
        <Card className="flex flex-col h-[min(70vh,600px)] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-trust/15 text-trust'}`}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {loading && (
              <p className="text-sm text-muted-foreground animate-pulse">Coach is thinking...</p>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your move coach anything..."
                className="rounded-xl"
                aria-label="Message to AI concierge"
              />
              <Button type="submit" variant="trust" size="icon" className="rounded-xl shrink-0" disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>

        {/* Task rail */}
        <aside className="space-y-3 hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Try asking</p>
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              className="w-full text-left text-sm rounded-xl border p-3 hover:border-trust/30 hover:bg-trust/5 transition-colors"
            >
              {p}
            </button>
          ))}
          <p className="text-[10px] text-muted-foreground pt-4">
            AI suggestions are informational. Always verify FMCSA, NMLS, and DOI licenses independently.
          </p>
        </aside>
      </div>
    </div>
  );
}