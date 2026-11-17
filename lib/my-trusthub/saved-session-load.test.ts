import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RESUME_UNAVAILABLE_COPY,
  ResumeCapabilityAbsentError,
  absorbResumeCapabilityAbsence,
  readOwnedSavedSession,
  rejectResumeRpc,
  savedSessionPageModel,
  type OwnedSavedSessionSummary,
} from "./saved-session-load.ts";

const FIXTURE_SESSION_ID = "4c961ac1-bbbe-4239-96c3-6daaf7135e80";
const OTHER_SESSION_ID = "00000000-0000-4000-8000-000000000001";

function ownedSummary(overrides: Partial<OwnedSavedSessionSummary> = {}): OwnedSavedSessionSummary {
  return {
    saved_session_id: FIXTURE_SESSION_ID,
    title: "qa-a",
    hub: "move",
    session_type: "plan",
    summary: { title: "qa-a" },
    status: "active",
    schema_key: "qa.isolation/v1",
    schema_version: 1,
    resume_available: true,
    resume_ref: FIXTURE_SESSION_ID,
    last_activity_at: "2026-11-17T00:00:00.000Z",
    ...overrides,
  };
}

async function loadPage(
  summaries: OwnedSavedSessionSummary[],
  resume: (resumeRef: string) => Promise<unknown>,
) {
  let resumeCalls = 0;
  try {
    const session = await readOwnedSavedSession(FIXTURE_SESSION_ID, summaries, async (resumeRef) => {
      resumeCalls += 1;
      return resume(resumeRef);
    });
    return { model: savedSessionPageModel({ absent: false, session }), resumeCalls };
  } catch (error) {
    try {
      return { model: savedSessionPageModel(absorbResumeCapabilityAbsence(error)), resumeCalls };
    } catch (propagated) {
      return { thrown: propagated, resumeCalls };
    }
  }
}

function assertUnavailable(model: { kind: string; httpStatus: number; copy?: string }) {
  assert.equal(model.kind, "resume-unavailable");
  assert.equal(model.httpStatus, 200);
  assert.notEqual(model.httpStatus, 500);
  assert.equal(model.copy, RESUME_UNAVAILABLE_COPY);
  assert.equal("session" in model, false);
  const serialized = JSON.stringify(model);
  assert.equal(serialized.includes("room_counts"), false);
  assert.equal(serialized.includes("estimated_cubic_feet"), false);
  assert.equal(serialized.includes("Rooms included"), false);
  assert.equal(serialized.includes("Estimated cubic feet"), false);
  assert.equal(serialized.includes("qa-a"), false);
}

test("owner and missing resume function renders a non-500 state without invented inventory", async () => {
  for (const error of [
    { code: "PGRST202", message: "schema cache stale" },
    { code: "42883", message: "undefined_function" },
  ]) {
    const loaded = await loadPage([ownedSummary()], async () => rejectResumeRpc(error));
    assert.equal(loaded.resumeCalls, 1);
    assert.equal(loaded.thrown, undefined);
    assertUnavailable(loaded.model!);
  }
});

test("message text that says the function does not exist is not classified as absent", async () => {
  const message = "function consumer.get_saved_session_for_resume(uuid) does not exist";
  for (const error of [
    { code: "42501", message },
    { code: "42501", message: "AUTH_REQUIRED" },
    { message },
    { code: "PGRST2020", message },
    { code: "428830", message: "42883 undefined_function" },
  ]) {
    const loaded = await loadPage([ownedSummary()], async () => rejectResumeRpc(error));
    assert.ok(loaded.thrown instanceof Error);
    assert.equal(loaded.thrown instanceof ResumeCapabilityAbsentError, false);
    assert.equal(loaded.model, undefined);
    const code = error.code ? `${error.code}: ` : "";
    assert.equal(loaded.thrown?.message, `My TrustHub data request failed (${code}${error.message})`);
  }
});

test("genuine database errors still throw", async () => {
  for (const error of [
    { code: "57014", message: "canceling statement due to statement timeout" },
    { code: "42P01", message: "relation does not exist" },
    { code: "XX000", message: "internal error" },
  ]) {
    const loaded = await loadPage([ownedSummary()], async () => rejectResumeRpc(error));
    assert.equal(loaded.thrown instanceof ResumeCapabilityAbsentError, false);
    assert.equal(loaded.thrown?.message, `My TrustHub data request failed (${error.code}: ${error.message})`);
  }
});

test("a network rejection propagates the original error", async () => {
  const network = new Error("connect ECONNREFUSED");
  const loaded = await loadPage([ownedSummary()], async () => {
    throw network;
  });
  assert.equal(loaded.thrown, network);
  assert.equal(loaded.model, undefined);
});

test("a non-owner id is not found, calls no resume RPC, and returns no saved body", async () => {
  const loaded = await loadPage([
    ownedSummary({
      saved_session_id: OTHER_SESSION_ID,
      title: "other-user-title",
      summary: { title: "other-user-title" },
      resume_ref: OTHER_SESSION_ID,
    }),
  ], async () => {
    throw new Error("resume must not be called");
  });
  assert.equal(loaded.resumeCalls, 0);
  assert.equal(loaded.thrown, undefined);
  assert.deepEqual(loaded.model, { kind: "not-found", httpStatus: 404 });
  const serialized = JSON.stringify(loaded.model);
  assert.equal(serialized.includes("other-user-title"), false);
  assert.equal(serialized.includes("qa-a"), false);
  assert.equal(serialized.includes(FIXTURE_SESSION_ID), false);
  assert.equal(serialized.includes("room_counts"), false);
});

test("an owned session with resume_available false is not found and is not a 500", async () => {
  const loaded = await loadPage([ownedSummary({ resume_available: false })], async () => {
    throw new Error("resume must not be called");
  });
  assert.equal(loaded.resumeCalls, 0);
  assert.deepEqual(loaded.model, { kind: "not-found", httpStatus: 404 });
  assert.notEqual(loaded.model?.httpStatus, 500);
});

test("a present resume payload is returned unchanged and does not invent room or volume defaults", async () => {
  const loaded = await loadPage([ownedSummary()], async () => ({ payload: { title: "qa-a" }, row_version: 3 }));
  assert.equal(loaded.model?.kind, "ready");
  if (loaded.model?.kind !== "ready") return;
  assert.equal(loaded.model.httpStatus, 200);
  assert.deepEqual(loaded.model.session.payload, { title: "qa-a" });
  assert.equal("room_counts" in loaded.model.session.payload, false);
  assert.equal("estimated_cubic_feet" in loaded.model.session.payload, false);
});

test("the session page keeps the unavailable state free of inventory fallbacks", () => {
  const page = readFileSync("app/my/sessions/[sessionId]/page.tsx", "utf8");
  const unavailable = page.slice(page.indexOf("function ResumeUnavailableState"), page.indexOf("export default"));
  assert.match(unavailable, /Saved research session/);
  assert.doesNotMatch(unavailable, /Rooms included|Estimated cubic feet|room_counts|estimated_cubic_feet|\?\? 1|\?\? 50/);
  assert.match(page, /requireWorkspace/);
  assert.match(page, /absorbResumeCapabilityAbsence/);
  assert.match(page, /savedSessionPageModel/);
  assert.match(page, /Resume in Move Trust Hub is not available yet/);
  assert.match(page, /Your saved research was preserved unchanged/);
  const adapter = readFileSync("lib/my-trusthub/production-adapter.ts", "utf8");
  const getSaved = adapter.slice(adapter.indexOf("async getSavedSession"), adapter.indexOf("async saveSession"));
  assert.match(getSaved, /rejectResumeRpc\(result\.error\)/);
  assert.match(getSaved, /rpc\("get_saved_session_for_resume"/);
  const validate = adapter.slice(adapter.indexOf("async validateSessionForResume"));
  assert.match(validate, /this\.rpc\("get_saved_session_for_resume"/);
  assert.doesNotMatch(validate, /rejectResumeRpc/);
  const actions = readFileSync("app/my/actions.ts", "utf8");
  for (const name of ["updateMoveInventorySessionAction", "resumeSavedSessionAction"]) {
    const start = actions.indexOf(`export async function ${name}`);
    const body = actions.slice(start, actions.indexOf("export async function", start + 1));
    assert.match(body, /redirectWhenResumeCapabilityAbsent/);
    assert.doesNotMatch(body, /safeMutation\([\s\S]*getSavedSession/);
  }
  assert.match(readFileSync("app/my/saved/page.tsx", "utf8"), /Save a moving inventory session/);
  assert.match(readFileSync("app/my/you/page.tsx", "utf8"), /requireWorkspace/);
});
