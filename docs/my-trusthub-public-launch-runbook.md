# My TrustHub public soft-launch runbook

1. Verify a post-P19 physical backup and record its timestamp.
2. Confirm the intended `origin/main` commit and production deployment.
3. Check Auth SMTP, notification worker, and Resend health.
4. Check the daily DBPR Watch poller and source health.
5. Verify Cloudflare Turnstile is enabled in Supabase Auth Attack Protection and the public site key is present; the secret remains in Supabase.
6. Set `MY_TRUSTHUB_CANARY_ONLY=false` and `MY_TRUSTHUB_SIGNUP_ENABLED=true`.
7. Enable Supabase public signup and retain email confirmation.
8. Smoke create-account, verified magic-link return, Save, Project, export, and deletion controls.
9. Monitor Vercel/Supabase logs, auth abuse, worker queues, and source health.
10. Roll back by disabling app signup, disabling Supabase signup, setting canary-only true, and independently setting email or master OFF if needed. Source monitoring may be disabled separately; never delete Watch state during rollback.

The final prelaunch state keeps signup closed and canary-only true until the operator performs this short sequence with CAPTCHA verified.
