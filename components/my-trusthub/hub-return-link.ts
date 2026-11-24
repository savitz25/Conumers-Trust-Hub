import { createElement } from "react";
import { validateHubReturn } from "../../lib/my-trusthub/hub-return.ts";

export const INVITE_ONLY_COPY = "My TrustHub accounts are invitation-only right now. Your research stays saved on this device.";

export function InviteOnlyNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return createElement("p", { role: "status" }, INVITE_ONLY_COPY);
}

export function HubReturnLink({ value, production }: { value: unknown; production: boolean }) {
  const result = validateHubReturn(value, { production });
  if (!result.ok) return null;
  return createElement("a", { className: "myth-hub-return", href: result.href, rel: "noreferrer" }, `Back to ${result.hubLabel}`);
}
