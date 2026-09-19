import { handleProfileConfirmation } from '@/lib/my-trusthub/profile-save/browser';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Isolated Auth/source-channel/store bindings require separate review. No pool,
// fixture, legacy account or production fallback is installed by this route.
export async function GET(request: Request) { return handleProfileConfirmation(request, null); }
export async function POST(request: Request) { return handleProfileConfirmation(request, null); }
