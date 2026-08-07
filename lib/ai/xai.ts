/**
 * Server-only xAI (SpaceXAI) helpers.
 * Env: XAI_API_KEY (required), XAI_MODEL (optional, default grok-4.5)
 */

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const XAI_BASE = 'https://api.x.ai/v1';

export function getXaiApiKey(): string | null {
  const key =
    process.env.XAI_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    process.env.X_AI_API_KEY?.trim() ||
    null;
  return key || null;
}

export function getXaiModel(): string {
  return (
    process.env.XAI_MODEL?.trim() ||
    process.env.GROK_MODEL?.trim() ||
    'grok-4.5'
  );
}

export async function createXaiChatCompletion(messages: ChatMessage[]): Promise<{
  content: string;
  model: string;
}> {
  const apiKey = getXaiApiKey();
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const model = getXaiModel();
  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[xai] chat error', res.status, errText.slice(0, 500));
    if (res.status === 429) {
      const err = new Error('RATE_LIMIT');
      throw err;
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('AUTH_FAILED');
    }
    throw new Error(`xAI request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Empty response from xAI');
  }

  return { content, model: data.model || model };
}
