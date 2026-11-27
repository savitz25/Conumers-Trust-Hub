const kind = new URL(import.meta.url).searchParams.get('kind');

function calls() {
  const state = globalThis;
  if (!state.__askProductEventCalls) state.__askProductEventCalls = [];
  return state.__askProductEventCalls;
}

if (kind === 'next') {
  globalThis.NextResponse = {
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: init.headers,
      });
    },
  };
}

export const NextResponse = {
  json(body, init = {}) {
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: init.headers,
    });
  },
};

export async function acceptClientProductEvent() {
  calls().push('acceptClientProductEvent');
}

export async function readSessionToken() {
  calls().push('readSessionToken');
  return null;
}

export async function withPlatform() {
  calls().push('withPlatform');
  return null;
}
