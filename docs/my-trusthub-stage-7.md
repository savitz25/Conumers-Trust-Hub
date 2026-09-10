# My TrustHub Stage 7

Stage 7 adds the public-account release gate and activates the P19 private export/deletion runtime for the founder canary. Export bundles contain only the authenticated consumer's supported workspace sections, are stored in the private database bundle column, use opaque job references, and expire after seven days. The owner-only download route is `private, no-store` and has no public metadata.

Deletion uses the existing P19 seven-day grace period, cancellable status, checkpointed worker steps, and 30-day operational retention boundary. It stops Watches and outbound delivery work, removes consumer-private state, and leaves Auth, Business Manager, shared network entities, and regulatory evidence independent.

Closed prelaunch posture is deliberately restored after certification: `MY_TRUSTHUB_ENABLED=true`, `MY_TRUSTHUB_CANARY_ONLY=true`, `MY_TRUSTHUB_SIGNUP_ENABLED=false`, Supabase public signup disabled, and export/delete enabled for the founder canary. Cloudflare Turnstile is enabled in Supabase Auth Attack Protection; the public site key is wired through Supabase's supported `captchaToken` option and the secret remains in Supabase. Public signup is returned OFF after certification.

Backup gate PASS: physical backup `2026-09-10 05:28:13 UTC`, after P19 completion at `2026-09-09 14:28:44 UTC`; restore is available and Founder is the recovery operator.

The exact limited Watch capability remains `contractor.fl.dbpr.license_status` v2 through DBPR's exact license lookup. Other hubs do not imply universal Watch support. Existing P11–P19 matrices, Stage 2–6 assertions, RLS boundaries, notification workers, and source polling remain required release checks.
