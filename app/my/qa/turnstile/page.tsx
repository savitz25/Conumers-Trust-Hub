import { notFound } from 'next/navigation';
import { TurnstileBrowserFixture } from '@/components/my-trusthub/turnstile-browser-fixture';

export const dynamic = 'force-dynamic';

export default function TurnstileBrowserFixturePage() {
  if (process.env.NODE_ENV !== 'development' || process.env.ATH_TURNSTILE_QA_FIXTURE !== 'true') {
    notFound();
  }

  return <TurnstileBrowserFixture />;
}
