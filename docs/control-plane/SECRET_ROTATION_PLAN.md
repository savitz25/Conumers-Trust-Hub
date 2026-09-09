# Control Plane secret rotation plan

No secret value belongs in this document, audit data, telemetry, source control, or client code. ATH-ADMIN-002 performs no rotation because the complete production dependency and rollback graph is not independently verifiable.

| Secret name/family | Class | Owners/consumers | Ordered action | Smoke / rollback | Performed |
|---|---|---|---|---|---|
| `ATH_OPERATOR_SECRET` | HUMAN LEGACY | Ask legacy operator/bootstrap endpoints | Activate named staff, prove Super Admin and disable flow, remove day-to-day login dependency, rotate, retain only controlled recovery/bootstrap use or disable bootstrap | Named Admin login, audit write, disable test; restore previous server env only under incident procedure | NO |
| `ATH_STAFF_EMAILS*` | HUMAN LEGACY | Ask internal allowlist guards | Keep legacy internal surfaces operational; stop using it for `/admin`; migrate/retire in ADMIN-008 | Internal claim-review smoke; restore prior env | NO |
| specialist `ADMIN_SECRET` variants | HUMAN LEGACY | Specialist legacy consoles | Inventory each console and operator before individual zero-downtime rotation; retire only in ADMIN-008 | Per-console auth/write smoke; restore prior secret | NO |
| `CRON_SECRET` | MACHINE | Scheduled jobs and refresh endpoints | Rotate consumer-by-consumer only after schedules and rollback are enumerated | Invoke each scheduled endpoint and inspect bounded logs | NO |
| `REVALIDATE_SECRET` | MACHINE | Revalidation endpoints | Rotate after every caller is known | Signed revalidation smoke; restore prior env | NO |
| `ATH_HANDOFF_SECRET` | MACHINE | Ask/specialist handoffs | Dual-key transition if supported; otherwise coordinated update | Six-hub handoff corpus; coordinated rollback | NO |
| `ASK_DATABASE_URL` / database credentials | SERVER PRIVILEGED | Ask server/migrations | Defer until backup, pool, deployment, and migration consumers are proven | Read/write transaction and rollback deployment | NO |
| `SUPABASE_SERVICE_ROLE_KEY*` | SERVER PRIVILEGED | Specialist server jobs | Never expose client-side; rotate per project only with all jobs known | Server job suite; previous-key rollback window | NO |
| public Supabase URL/anon key names | PUBLIC CLIENT | Browser clients where configured | Not secrets; review RLS before any key lifecycle change | Anonymous/RLS regression | NO |
| email/Resend credentials | EMAIL/SMS | Auth and notifications | Rotate after sender domains, webhooks, and auth delivery are inventoried | Magic-link and notification delivery | NO |
| RingCentral/SMS credentials | EMAIL/SMS | Any enabled messaging adapters | Rotate only after active consumers are confirmed | Test message in approved non-production target | NO |
| external data/API keys | EXTERNAL API | Google Places, FMCSA, BBB and specialist adapters | Rotate independently with quota/source smoke | Adapter-specific fetch and rollback | NO |

ADMIN-002 retirement sequence: activate migration; authenticate canonical user; one-time bootstrap; validate named Admin routes and audit; validate a second staff disable; remove `ATH_OPERATOR_SECRET` from normal human entry; rotate it with rollback ready. Shared machine, database, handoff, and specialist secrets are explicitly excluded from broad rotation.
