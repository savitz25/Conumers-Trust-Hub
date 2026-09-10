# My TrustHub Stage 7

Stage 7 adds the public-account release gate and activates the P19 private export/deletion runtime for the founder canary. Export bundles contain only the authenticated consumer's supported workspace sections, are stored in the private database bundle column, use opaque job references, and expire after seven days. The owner-only download route is `private, no-store` and has no public metadata.

Deletion uses the existing P19 seven-day grace period, cancellable status, checkpointed worker steps, and 30-day operational retention boundary. It stops Watches and outbound delivery work, removes consumer-private state, and leaves Auth, Business Manager, shared network entities, and regulatory evidence independent.

Closed prelaunch posture is deliberately restored after certification: `MY_TRUSTHUB_ENABLED=true`, `MY_TRUSTHUB_CANARY_ONLY=true`, `MY_TRUSTHUB_SIGNUP_ENABLED=false`, Supabase public signup disabled, and export/delete enabled for the founder canary. Launch posture is documented but not left open. CAPTCHA is an explicit launch-day dependency: the app accepts a provider verification hook, but no new external CAPTCHA account or secret was provisioned in this run.

The exact limited Watch capability remains `contractor.fl.dbpr.license_status` v2 through DBPR's exact license lookup. Other hubs do not imply universal Watch support. Existing P11–P19 matrices, Stage 2–6 assertions, RLS boundaries, notification workers, and source polling remain required release checks.
