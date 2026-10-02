import { handleProfileConfirmation } from '@/lib/my-trusthub/profile-save/browser';
import { hostedRuntime } from '@/lib/my-trusthub/profile-save/hosted-runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const deployed = await hostedRuntime();
  return handleProfileConfirmation(request, deployed ? await deployed.browserBindings(request) : null);
}
export const GET = handle;
export const POST = handle;
