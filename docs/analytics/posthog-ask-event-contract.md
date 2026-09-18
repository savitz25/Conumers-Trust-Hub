# AskTrustHub PostHog event contract — My TrustHub journey + auth URL privacy (ATH-OBS-002D / 002E)

Companion to `docs/analytics/posthog-ask-reference.md` (ATH-OBS-001, initialization/identity/general
privacy). This document is written for a reader analyzing events in PostHog, not the source.

## 1. My TrustHub canonical events (ATH-OBS-002D)

**Rule: one semantic action = one event.** A form *submit* is an **intent** — the server has not
done anything yet. A **success** or **failure** event fires only after the server actually completed
(or rejected) the mutation. Source of truth: `lib/analytics/my-trusthub-contract.ts`.

| Event | Meaning | Fires from |
|---|---|---|
| `profile_save_intent` | Customer clicked Save | client, on submit |
| `profile_saved` | Save **confirmed** by the server | client, from a server-set URL marker |
| `profile_save_failed` | Save rejected/failed | client, from a server-set URL marker |
| `auth_continuation_started` | Guest routed to sign-in to finish a Save | client, from `?continue=save` |
| `auth_continuation_completed` | Sign-in confirmed, customer back on `/my` | client, from `?auth=complete` |
| `auth_continuation_failed` | Sign-in/link/callback failed | client, from a bounded `?error=` code |
| `project_created` | Project **confirmed** created | client, from `?created=1` |
| `project_create_failed` | Project creation rejected | client, from `?failed=project` |
| `project_item_added` | Saved research added to a project | client, after the server action resolves |
| `watch_created` | Watch **confirmed** started | client, from `?started=1` |
| `watch_create_failed` | Watch start rejected | client, from `?failed=watch` |

### The minimum funnel

```
profile_save_intent → auth_continuation_started (guest only) → auth_continuation_completed → profile_saved
```

`profile_save_intent → profile_saved` alone covers an already-authenticated customer. Filter by
`action_source` to separate the direct-form path, the guest-research-import path, and the
cross-hub specialist-handoff path (see below).

### Allowed properties (closed enums only — `lib/analytics/my-trusthub-contract.ts`)

| Property | Values |
|---|---|
| `surface` | `my_saved`, `my_projects`, `my_project_detail`, `my_watches`, `my_sign_in`, `my_home` |
| `action_source` | `my_saved_form`, `guest_import`, `specialist_handoff` |
| `auth_state` | `guest`, `authenticated` |
| `outcome` | `intent`, `success`, `failure` |
| `failure_reason` | `unable`, `handoff_unavailable`, `import_invalid`, `import_none_selected`, `coverage_required`, `invalid_email`, `signin_unavailable`, `link_delivery`, `captcha_required`, `callback_missing_code`, `callback_exchange`, `callback_session`, `callback_unavailable`, `access_restricted` |
| `continuation_reason` | `save_handoff`, `direct` |
| `handoff_type` | `contractor_save` |
| `specialist_hub` | `move`, `lender`, `insurance`, `contractor`, `senior`, `investor` |
| `project_context_present` | `true` / `false` |

A property value that is not in its list is dropped, not coerced — `boundedJourneyProperties()` is
the only path an event's properties can take, and it is allow-list-first (key, then enum member).
Also inherited on every event: `hub` (`"ask"`), `environment`.

### Prohibited — never a property, never attempted

Email, name, phone, any regulatory identifier (NMLS/USDOT/CCN/CRD/NPN), auth tokens/codes, opaque
handoff codes, project/saved-entity ids, project notes or private content, raw search text, full
URLs, free-form exception text, or any string that isn't a member of the tables above.
`stripForbiddenProperties` / `FORBIDDEN_EVENT_KEYS` in `lib/analytics/privacy.ts` remain a second,
independent backstop in front of the PostHog client, but the contract itself never generates a
forbidden key in the first place.

### Why success is measured from a URL marker, not the click

A server action either returns to the same page (no navigation) or redirects. For actions that
redirect (`saveCanaryEntityAction`, `createProjectAction`, `startWatchAction`, magic-link,
auth callback, the Contractor Save handoff), the ONLY point where "the server actually did it" is
knowable is that redirect target — so the server encodes the confirmed outcome as a bounded
one-shot query parameter (`?saved=1`, `?created=1`, `?started=1`, `?failed=save`, …), and
`components/analytics/my-trusthub-outcomes.tsx` maps it to its canonical event, captures it once,
then strips the parameter from the address bar via `history.replaceState`. A parameter VALUE is
matched only against known literals (`'1'`, `'save'`, `'coverage-required'`, …) and is never
forwarded as a property — the event and its properties come entirely from the contract's own
mapping table.

This is also what prevents double-counting: refresh or Back re-request the URL, but the marker is
already gone, so nothing re-fires. A `createOnceGuard` additionally collapses a same-marker,
same-URL React double-render (Strict Mode) within a 2-second window, while still counting a
genuinely later repeat of the same action.

For an action that does NOT redirect (adding saved research to a project), the "confirmed" event is
captured directly from the resolved server-action promise (`components/analytics/tracked-action-form.tsx`)
— a throwing action never reaches the capture line.

### Guest → account continuation, and cross-hub handoff

- **Guest Save → auth continuation.** `app/my/handoff/prepare/route.ts` redirects an unauthenticated
  visitor to `/my/sign-in?continue=save`, which fires `auth_continuation_started`. The reason is
  remembered client-side (`localStorage`, bounded enum + timestamp, 1-hour TTL — see
  `CONTINUATION_REASON_STORAGE_KEY`) so `auth_continuation_completed` on `/my?auth=complete` (set by
  `app/auth/callback/route.ts` after `exchangeCodeForSession` AND entitlement validation succeed) can
  still say `continuation_reason: "save_handoff"` after the email round-trip. No PII crosses that
  boundary — only one of two enum members.
- **Cross-hub handoff (Contractor → Ask Save).** `app/my/handoff/finish/route.ts` sets
  `?handoff=saved` (success) or `?handoff=failed` (any consume failure) on its redirect to
  `/my/saved`, captured as `profile_saved` / `profile_save_failed` with
  `action_source: "specialist_handoff"`, `handoff_type: "contractor_save"`, `specialist_hub: "contractor"`.
- **Project add / Watch create** are gated behind `MY_TRUSTHUB_PROJECTS_ENABLED` /
  `MY_TRUSTHUB_WATCH_ENABLED` respectively and are only wired up because both already exist in the
  current My TrustHub implementation (`app/my/actions.ts`). No event was invented for a capability
  that does not exist.

### Before → after

| Journey action | Before | After (canonical) | Trigger point |
|---|---|---|---|
| Click Save | `profile_saved` (fired on submit, before any server call) | `profile_save_intent` | client, `onSubmit` |
| Save confirmed by server | *(no separate signal — the submit-time event was the only one)* | `profile_saved` | client, from `?saved=1` |
| Save rejected by server | *(silent — user saw `?error=unable`, nothing measured)* | `profile_save_failed` | client, from `?failed=save` |
| Guest Save routed to sign-in | *(unmeasured)* | `auth_continuation_started` | client, from `?continue=save` |
| Sign-in completed, back on `/my` | *(unmeasured)* | `auth_continuation_completed` | client, from `?auth=complete` |
| Contractor Save handoff arrives | `?handoff=saved` banner only, no event | `profile_saved` (`action_source: specialist_handoff`) | client, from `?handoff=saved` |
| Contractor Save handoff fails | plain-text error page, unmeasured | `profile_save_failed` | client, from `?handoff=failed` |
| Click Create Project | `project_created` (on submit, pre-confirmation) | `project_created` moved to confirmation; submit fires nothing new (no intent event was requested for this surface beyond what already existed) | client, from `?created=1` |
| Project creation rejected | *(unmeasured)* | `project_create_failed` | client, from `?failed=project` |
| Add saved research to a project | unmeasured | `project_item_added` | client, after the server action resolves |
| Start a Watch | unmeasured | `watch_created` / `watch_create_failed` | client, from `?started=1` / `?failed=watch` |

## 2. `auth_error` URL privacy (ATH-OBS-002E)

### Root cause

`/claim/continue?auth_error=…` is populated from two server routes. Before this fix:

- `app/api/customer/auth/verify/route.ts` placed a raw `AuthError.code` (an internal enum already —
  classified **SAFE_ENUM** — but never validated against an allow-list before entering the URL).
- `app/api/customer/claim/accept/route.ts` placed, in order of precedence: an internal
  `HandoffError`/`ClaimError` code (SAFE_ENUM, also unvalidated), an arbitrary `.code` off any thrown
  object, or **the first 80 characters of `Error.message`** — classified **FREE_TEXT**. That message
  can originate from a specialist-hub HTTP client, JSON parsing, or any unexpected exception, and
  nothing bounded its content: a stack fragment, an internal URL, or (depending on the failure) an
  identifier could reach the query string, and from there the page and PostHog.

The page then read `sp.auth_error` as opaque text and passed it straight into
`ClaimFunnelAnalytics`/`ClaimRecoveryCard` as `resultState` — so whatever reached the URL also
reached the `claim_recovery_viewed` analytics call.

### Layer 1 — application (`lib/customer/auth-error-code.ts`)

Both producing routes and the one consuming page now go through the same closed set,
`CLAIM_AUTH_ERROR_CODES` (the existing `CustomerClaimErrorCode` enum plus four sign-in states:
`expired_link`, `consumed_link`, `rate_limited`, `auth_failed`):

- `claimAcceptErrorCode()` maps a known internal handoff/claim code to its public recovery code
  (the same mapping table that existed before, moved unchanged) and collapses anything else —
  including exception text — to `HANDOFF_INVALID`, the state already shown for an invalid handoff.
- `signInLinkErrorCode()` maps a known `AuthError.code` through; anything else becomes `auth_failed`.
- `readClaimAuthErrorParam()` is the INBOUND check: the query string is user/attacker-controlled, so
  the page re-validates it before display or analytics, independent of what the producing route
  intended to send.

No exception message, token, code, or identifier can reach the URL after this change; a value
outside the enum becomes a generic member of the enum, never the original text.

### Layer 2 — analytics sanitizer (`lib/analytics/privacy.ts`), defense in depth

Even if the application ever regresses, the shared sanitizer now strips `auth_error` (and its
common variants) from every URL-shaped surface PostHog can capture, using the SAME `sanitizeAnalyticsUrl`
matcher the ATH-OBS-002C search-query fix uses:

- `$current_url`, `$referrer`, `$initial_current_url`, `$session_entry_url`, `$entry_current_url`,
  `$initial_referrer`, `$session_entry_referrer`, `$prev_pageview_url` — all query-string-bearing
  properties `before_send` can see, including nested copies in `$set` / `$set_once`.
- Session Replay `start_url` / recorded network request names
  (`maskCapturedNetworkRequestFn` → `sanitizeCapturedNetworkRequest`).
- Replay snapshot `href` values (`$snapshot_data`, rrweb Meta events).
- **New in this change:** autocapture/link-click metadata — `$external_click_url`, `$elements[].attr__href`
  (and `attr__action`/`attr__formaction`/`attr__src`), and `$elements_chain` (a serialized string,
  redacted key-by-key rather than URL-parsed, since it isn't a single URL).

The key match is now a single substring pattern (`isSensitiveQueryKey`), so `authError`, `AUTH_ERROR`,
`x_auth_error_msg`, `error_description`, etc. are all covered without enumerating every casing.

### Before → after (data path)

```
BEFORE:
  exception / internal code
    → /claim/continue?auth_error=<raw text or unvalidated code>   (URL)
    → ClaimRecoveryCard resultState={String(code)}                (event property)
    → PostHog $current_url / $session_entry_url / replay / event  (captured, unsanitized beyond generic key list)

AFTER:
  exception / internal code
    → claimAcceptErrorCode() / signInLinkErrorCode()               (Layer 1: collapsed to a closed enum)
    → /claim/continue?auth_error=<enum member only>                (URL)
    → readClaimAuthErrorParam() re-validates on READ               (Layer 1: page never trusts the URL either)
    → ClaimRecoveryCard resultState=<same enum, re-validated>      (event property)
    → sanitizeAnalyticsUrl() / sanitizePageviewProperties()        (Layer 2: auth_error stripped from every URL PostHog sees, regardless of Layer 1)
```

### UX

`/claim/continue` now shows the sign-in-specific message above the existing `ClaimRecoveryCard` for
the four sign-in codes (e.g. `expired_link` → "This sign-in link has expired. Request a new link to
continue."); claim-recovery codes (`HANDOFF_EXPIRED`, `PROFILE_NOT_FOUND`, …) keep their existing
copy and actions in `lib/customer/claim-recovery.ts`, unchanged. No internal exception is ever shown.

## 3. Production verification (for PostHoggy)

### ATH-OBS-002D

1. In an incognito window, open `/network` (or another public profile) → My TrustHub → Save →
   confirm `profile_save_intent` recorded immediately.
2. If routed to sign-in, confirm `auth_continuation_started` (`continuation_reason: save_handoff`);
   complete the email link; confirm `auth_continuation_completed` on arrival at `/my`, same reason.
3. Confirm `profile_saved` fires exactly once, with `outcome: success`, and that the URL no longer
   shows `?saved=1` / `?handoff=saved` after the page settles (Network tab or Elements → address bar).
4. Repeat with Create Project and Start Watch; confirm `project_created` / `watch_created`.
5. Force a failure (e.g. resubmit an already-consumed guest-import selection) and confirm the
   matching `_failed` event, not a `_saved`/`_created` event.
6. Refresh and use Back after each success; confirm no duplicate event fires.
7. Inspect every captured event's properties: only the tables in §1 should appear — no email, id, or
   free text.

### ATH-OBS-002E

1. Deliberately expire or reuse a claim/sign-in link, or tamper with a handoff parameter, to reach
   `/claim/continue?auth_error=…`.
2. Confirm the page shows the correct safe message and never an exception string.
3. In PostHog, inspect the resulting `$pageview` / `claim_recovery_viewed` event: `$current_url`,
   `$session_entry_url` must not contain `auth_error=` at all (the key itself is removed, not just
   masked).
4. If Session Replay is on for this session, open the recording and inspect its `start_url` /
   metadata — same result.
5. Try a few adversarial values against a non-production build (append `?auth_error=` directly) and
   confirm the page falls back to the generic invalid-handoff state rather than reflecting the value.
6. Confirm an unrelated parameter on the same URL (e.g. `utm_source`) is still present in the
   captured URL — sanitization must not delete more than the sensitive keys.

## 4. Porting to specialist hubs (future work, not implemented here)

- `lib/analytics/my-trusthub-contract.ts` has no Ask-specific import and can be copied as-is; only
  `specialist_hub` values and `handoff_type` may need a hub-specific extension.
- `lib/customer/auth-error-code.ts`'s pattern (closed producer-side mapping + independent
  consumer-side re-validation) generalizes directly; a specialist hub's own claim/auth codes would
  get their own enum.
- `sanitizeAnalyticsUrl` / `sanitizePageviewProperties` are hub-agnostic already (they operate on
  whatever URL/properties they're given) — a specialist hub would import `lib/analytics/privacy.ts`
  unchanged if it adopts the same PostHog project.
- Do not roll any of this out to a specialist hub under this ticket.
