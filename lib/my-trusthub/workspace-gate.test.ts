import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { homeWorkspaceGate, privateWorkspaceGate } from "./workspace-gate.ts";

const savedSurfaces = [
  "app/my/saved/page.tsx",
  "app/my/projects/page.tsx",
  "app/my/projects/[projectId]/page.tsx",
  "app/my/sessions/[sessionId]/page.tsx",
  "app/my/you/page.tsx",
];

test("signed-out or unavailable private workspace routes use the sign-in gate", () => {
  assert.deepEqual(
    privateWorkspaceGate({ featureEnabled: false, adapterAvailable: false, userPresent: false }),
    { kind: "redirect", href: "/my/sign-in" },
  );
  assert.deepEqual(
    privateWorkspaceGate({ featureEnabled: false, adapterAvailable: true, userPresent: true }),
    { kind: "redirect", href: "/my/sign-in" },
  );
  assert.deepEqual(
    privateWorkspaceGate({ featureEnabled: true, adapterAvailable: true, userPresent: false }),
    { kind: "redirect", href: "/my/sign-in" },
  );
  assert.deepEqual(
    privateWorkspaceGate({ featureEnabled: true, adapterAvailable: false, userPresent: false }),
    { kind: "redirect", href: "/my/sign-in?configuration=missing" },
  );
  assert.deepEqual(
    privateWorkspaceGate({ featureEnabled: true, adapterAvailable: true, userPresent: true }),
    { kind: "open" },
  );
});

test("home uses the sign-in gate only when My TrustHub is disabled", () => {
  assert.deepEqual(
    homeWorkspaceGate({ featureEnabled: false, adapterAvailable: false, userPresent: false }),
    { kind: "redirect", href: "/my/sign-in" },
  );
  assert.deepEqual(
    homeWorkspaceGate({ featureEnabled: true, adapterAvailable: true, userPresent: false }),
    { kind: "lander" },
  );
  assert.deepEqual(
    homeWorkspaceGate({ featureEnabled: true, adapterAvailable: false, userPresent: false }),
    { kind: "lander" },
  );
  assert.deepEqual(
    homeWorkspaceGate({ featureEnabled: true, adapterAvailable: true, userPresent: true }),
    { kind: "open" },
  );
});

test("saved surfaces delegate the signed-out decision and do not 404 on the master flag", () => {
  const pageData = readFileSync("lib/my-trusthub/page-data.ts", "utf8");
  assert.match(pageData, /privateWorkspaceGate/);
  assert.doesNotMatch(pageData, /notFound/);
  assert.match(pageData, /await cookies\(\)/);
  for (const path of savedSurfaces) {
    assert.match(readFileSync(path, "utf8"), /requireWorkspace/);
  }
  const home = readFileSync("app/my/page.tsx", "utf8");
  assert.match(home, /homeWorkspaceGate/);
  assert.doesNotMatch(home, /notFound/);
});
