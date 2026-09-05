import { NextResponse } from 'next/server';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { caConciergeContext } from '@/lib/network/ca-network';
import { txConciergeContext } from '@/lib/network/tx-network';
import { waConciergeContext } from '@/lib/network/wa-network';
import { planAskResearch } from '@/lib/network/research-planner';
import { resolveResearchScope } from '@/lib/network/research-scope';
import { conciergeDestinationContext, resolveResearchDestinations } from '@/lib/network/research-destinations';
import {
  createXaiChatCompletion,
  getXaiApiKey,
  type ChatMessage,
} from '@/lib/ai/xai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_MESSAGES = 24;
const MAX_CONTENT_LEN = 4000;

type ClientMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function sanitizeMessages(input: unknown): ClientMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ClientMessage[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const role = (row as { role?: string }).role;
    const content = (row as { content?: string }).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      continue;
    }
    const trimmed = content.trim().slice(0, MAX_CONTENT_LEN);
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
    if (out.length >= MAX_MESSAGES) break;
  }
  return out;
}

export async function POST(request: Request) {
  const started=performance.now();
  try {
    if (!getXaiApiKey()) {
      return NextResponse.json(
        {
          error:
            'The Concierge is temporarily unavailable (AI key not configured). Please try again later or browse /network.',
        },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const messages = sanitizeMessages(
      body && typeof body === 'object' ? (body as { messages?: unknown }).messages : null
    );

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      return NextResponse.json({ error: 'A user message is required' }, { status: 400 });
    }

    const plan=planAskResearch(lastUser.content);const scope=resolveResearchScope(plan);const destinations=resolveResearchDestinations({researchPlan:plan,executionScope:scope,limit:3});
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: `${ASK_CONCIERGE_SYSTEM_PROMPT}\n\n${caConciergeContext()}\n\n${txConciergeContext()}\n\n${waConciergeContext()}\n\n${conciergeDestinationContext(plan,scope)}` },
      ...messages,
    ];

    const { content, model } = await createXaiChatCompletion(apiMessages);

    return NextResponse.json({
      message: { role: 'assistant' as const, content },
      model,
      route:{hub:plan.primaryHub,intent:plan.intent,requestedScope:scope.requestedGeography?.display,executionScope:scope.executionGeography?.display,destinations:destinations.map(({id,label,href,owner})=>({id,label,href,owner})),researchHref:`/ask?q=${encodeURIComponent(lastUser.content)}`},
      diagnostics:{totalMs:+(performance.now()-started).toFixed(1),queryLength:lastUser.content.length},
    });
  } catch (err) {
    console.error('[api/chat]', err);
    const code = err instanceof Error ? err.message : '';
    if (code === 'RATE_LIMIT') {
      return NextResponse.json(
        {
          error:
            'The Concierge is busy right now (rate limit). Please wait a moment and try again.',
        },
        { status: 429 }
      );
    }
    if (code === 'AUTH_FAILED') {
      return NextResponse.json(
        {
          error:
            'The Concierge is temporarily unavailable. Please try again later or browse /network.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error:
          'Something went wrong talking to the Concierge. Please try again in a moment.',
      },
      { status: 500 }
    );
  }
}
