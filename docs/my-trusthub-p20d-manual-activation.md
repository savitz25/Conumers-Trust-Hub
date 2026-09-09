# My TrustHub P20D manual activation

This is the founder-only handoff after P20D-PREP. Do not perform these steps
until manual P20D activation is approved. Never paste Supabase secret values or
the founder address into ChatGPT, Codex, Git, documentation, screenshots, or
issue comments.

## Step 1 — configure the Vercel Production environment

1. Open Vercel.
2. Select the Ask Trust Hub project (`conumers-trust-hub`).
3. Open **Settings → Environment Variables**.
4. Select **Production** scope only.
5. Preserve the existing `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and all `ATH_*`
   variables exactly as found. Do not edit, delete, or repurpose them.
6. Verify the existing `NEXT_PUBLIC_SITE_URL` is exactly
   `https://www.asktrusthub.com`. Reuse it as the canonical origin; do not
   recreate or rename it if already exact.
7. Add or update only the My TrustHub variables in
   `config/my-trusthub-p20d-vercel-env.md`.
8. Enter the approved founder address only in
   `MY_TRUSTHUB_CANARY_EMAILS`.
9. Set `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` to the permanent Consumer project
   URL shown in the manifest.
10. From the **Conumers-Trust-Hub** Supabase project's **Connect** dialog, copy
    its modern publishable key into
    `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY`. Do not use any existing
    AskTrustHub generic key and do not use a secret or legacy service-role key.
11. Verify all later-stage flags are explicitly `false`.
12. Save the variables. Do not deploy or redeploy yet.

Do **not** add `MY_TRUSTHUB_SUPABASE_SECRET_KEY` to Vercel and do not replace or
reuse the existing `SUPABASE_SERVICE_ROLE_KEY`. The My TrustHub secret is only a
temporary local-process input for Step 2.

## Step 2 — create or verify the one canonical Auth user

Before running the script, recheck that the permanent project is
`qvvxvbcdmbjzrgvwjatw`, public signup remains disabled, and `auth.users=0`.

Obtain a modern server secret from Supabase:

1. Open the permanent Supabase project.
2. Open **Settings → API Keys**.
3. Prefer a modern secret key beginning with `sb_secret_`.
4. If the project offers only the legacy `service_role` key, it may be used,
   but treat it as a highly privileged server credential.
5. Do not rotate or generate a key for this step.

From the root of the clean integration branch, use a fresh PowerShell process.
Interactive prompts keep the email and secret out of command history:

```powershell
$env:MY_TRUSTHUB_CANARY_EMAIL = Read-Host "Approved founder canary email"
$env:MY_TRUSTHUB_SUPABASE_URL = "https://qvvxvbcdmbjzrgvwjatw.supabase.co"
$secretInput = Read-Host "Supabase secret key" -AsSecureString
$env:MY_TRUSTHUB_SUPABASE_SECRET_KEY = [Net.NetworkCredential]::new("", $secretInput).Password
$env:MY_TRUSTHUB_CONFIRM_CREATE = "CREATE_ONE_MY_TRUSTHUB_CANARY"
node scripts/create-my-trusthub-canary.mjs
Remove-Item Env:MY_TRUSTHUB_CANARY_EMAIL
Remove-Item Env:MY_TRUSTHUB_SUPABASE_URL
Remove-Item Env:MY_TRUSTHUB_SUPABASE_SECRET_KEY
Remove-Item Env:MY_TRUSTHUB_CONFIRM_CREATE
$secretInput = $null
```

Leave `MY_TRUSTHUB_ALLOW_EXISTING_UNRELATED_USERS` unset. The script will refuse
to proceed if an unrelated Auth user exists, creates the exact user through
`auth.admin.createUser()`, confirms the founder-owned email for the passwordless
flow, writes `my_trusthub_canary: true` to trusted `app_metadata`, and is
idempotent for the exact existing canary.

Expected safe output contains only:

- `created`: true or false
- canonical user ID
- entitlement state
- email-confirmed state

## Resume P20D

After both steps, provide only these non-secret confirmations:

- Vercel Production manifest saved
- script result (`created`, user ID, entitlement state)
- `auth.users` count equals exactly one

Then resume P20D. The builder must revalidate production-main alignment, deploy
the reviewed branch, perform the real same-browser PKCE login, create only the
controlled canary Save/Project state, run authorization/privacy/mobile checks,
and stop before Stage 2.
