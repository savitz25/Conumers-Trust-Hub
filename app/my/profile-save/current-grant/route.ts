import { hostedRuntime } from '@/lib/my-trusthub/profile-save/hosted-runtime';
import { handleCurrentGrant } from '@/lib/my-trusthub/profile-save/grant-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) { return handleCurrentGrant(request, await hostedRuntime(), true); }
export const GET = handle;
export const POST = handle;
