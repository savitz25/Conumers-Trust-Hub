'use client';
import { useAskChat } from '@/components/ask-chat/ask-chat-context';
import { trackEvent } from '@/lib/analytics/track';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
export function AskAiExplainButton({question}:{question:string}){const {openChat}=useAskChat();return <button type="button" onClick={()=>{trackEvent(ANALYTICS_EVENTS.RESEARCH_TO_CONCIERGE,{length:Math.min(question.length,2000)});openChat({initialPrompt:question})}} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold text-[#4F46E5]">Ask AI to explain</button>}
