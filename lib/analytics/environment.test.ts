import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsEnvironment, shouldEnablePosthog } from './environment.ts';

test('analyticsEnvironment uses Vercel env and never assumes production', () => {
  const previousPublic = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const previous = process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  delete process.env.VERCEL_ENV;
  assert.equal(analyticsEnvironment(), 'development');
  process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview';
  assert.equal(analyticsEnvironment(), 'preview');
  process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
  assert.equal(analyticsEnvironment(), 'production');
  if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  else process.env.NEXT_PUBLIC_VERCEL_ENV = previousPublic;
  if (previous === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previous;
});

test('PostHog stays off without production env and token/host', () => {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV;
  process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview';
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'phc_test';
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';
  assert.equal(shouldEnablePosthog(), false);
  process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  assert.equal(shouldEnablePosthog(), false);
  if (token === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  else process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = token;
  if (host === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  else process.env.NEXT_PUBLIC_POSTHOG_HOST = host;
  if (vercel === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  else process.env.NEXT_PUBLIC_VERCEL_ENV = vercel;
});
