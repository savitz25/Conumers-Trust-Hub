/**
 * Signed-out entry for private My TrustHub pages.
 * A disabled master flag on an isolated preview must use the same /my/sign-in
 * gate as an explicit sign-in visit (including the unavailable-in-environment
 * state). It must not answer 404.
 */
export type WorkspaceGateInput = {
  featureEnabled: boolean;
  adapterAvailable: boolean;
  userPresent: boolean;
};

export type PrivateWorkspaceGate =
  | { kind: "open" }
  | { kind: "redirect"; href: "/my/sign-in" | "/my/sign-in?configuration=missing" };

export type HomeWorkspaceGate =
  | { kind: "open" }
  | { kind: "lander" }
  | { kind: "redirect"; href: "/my/sign-in" };

export function privateWorkspaceGate(input: WorkspaceGateInput): PrivateWorkspaceGate {
  if (!input.featureEnabled) return { kind: "redirect", href: "/my/sign-in" };
  if (!input.adapterAvailable) return { kind: "redirect", href: "/my/sign-in?configuration=missing" };
  if (!input.userPresent) return { kind: "redirect", href: "/my/sign-in" };
  return { kind: "open" };
}

/** Home keeps its signed-out lander only while My TrustHub itself is enabled. */
export function homeWorkspaceGate(input: WorkspaceGateInput): HomeWorkspaceGate {
  if (!input.featureEnabled) return { kind: "redirect", href: "/my/sign-in" };
  if (!input.adapterAvailable || !input.userPresent) return { kind: "lander" };
  return { kind: "open" };
}
