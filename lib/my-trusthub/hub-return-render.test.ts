import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HubReturnLink, INVITE_ONLY_COPY, InviteOnlyNotice } from "../../components/my-trusthub/hub-return-link.ts";
import { registrationInvitationAvailable, type AccountEnv } from "./account-policy.ts";

const move = "https://www.movetrusthub.com/companies/hindman-isaacs-moving-storage-inc";
const pages = ["sign-in", "email-link", "recover", "create-account"];

test("auth and workspace pages render a hub link and invitation-only copy", () => {
  const link = renderToStaticMarkup(createElement(HubReturnLink, { value: move, production: true }));
  assert.match(link, /href="https:\/\/www\.movetrusthub\.com\/companies\/hindman-isaacs-moving-storage-inc"/);
  assert.match(link, />Back to Move Trust Hub</);
  assert.equal(link.includes("http-equiv"), false);
  assert.equal(renderToStaticMarkup(createElement(HubReturnLink, { value: "https://evil.example/companies/acme", production: true })), "");
  const notice = renderToStaticMarkup(createElement(InviteOnlyNotice, { show: true }));
  assert.equal(notice.includes(INVITE_ONLY_COPY), true);
  assert.equal(notice.toLowerCase().includes("create account"), false);
  assert.equal(renderToStaticMarkup(createElement(InviteOnlyNotice, { show: false })), "");
  const internal: AccountEnv = { MY_TRUSTHUB_ENABLED: "true", MY_TRUSTHUB_ACCESS_MODE: "internal", MY_TRUSTHUB_SIGNUP_ENABLED: "true" };
  assert.equal(registrationInvitationAvailable(internal), false);
  assert.equal(registrationInvitationAvailable({}), false);
  const entry = readFileSync(new URL("../../components/my-trusthub/account-entry.tsx", import.meta.url), "utf8");
  assert.equal(entry.includes("InviteOnlyNotice"), true);
  assert.equal(entry.includes("HubReturnLink"), true);
  assert.equal(entry.includes("registrationAvailable ? <Link href={href('/my/create-account')}>Create account</Link>"), true);
  for (const page of pages) {
    const source = readFileSync(new URL(`../../app/my/${page}/page.tsx`, import.meta.url), "utf8");
    assert.equal(source.includes("AccountEntry"), true, page);
  }
  const shell = readFileSync(new URL("../../components/my-trusthub/my-shell.tsx", import.meta.url), "utf8");
  assert.equal(shell.includes("HubReturnLink"), true);
  assert.equal(shell.includes("redirect("), false);
});
