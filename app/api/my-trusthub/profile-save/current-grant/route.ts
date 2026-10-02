import { hostedRuntime } from '@/lib/my-trusthub/profile-save/hosted-runtime';
import { handleCurrentGrant } from '@/lib/my-trusthub/profile-save/grant-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleCurrentGrant(request, await hostedRuntime(), false); }
