/** TEST FIXTURE ONLY. The Hindman & Isaacs reference mover the one-click path
 * was first proven with. No runtime module imports this: the runtime resolves
 * any supported Move mover by its exact identity. */
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';
export const TEST_PROFILE: ProfileIdentity = { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' };
export const TEST_SLUG = 'hindman-isaacs-moving-storage-inc';
