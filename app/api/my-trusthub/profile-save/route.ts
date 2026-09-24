import { handleProfileSave } from '@/lib/my-trusthub/profile-save/http';
import { deploymentBindings } from '@/lib/my-trusthub/profile-save/deployment';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handleProfileSave(request, deploymentBindings());
}
