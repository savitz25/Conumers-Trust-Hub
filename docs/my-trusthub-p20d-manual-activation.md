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
5. Add or update every production-runtime variable in
   `config/my-trusthub-p20d-vercel-env.md`.
6. Enter the approved founder address only in
   `MY_TRUSTHUB_CANARY_EMAILS`.
7. Copy the project URL and publishable key from Supabase using the project's
   **Connect** dialog. The browser key must be the modern publishable key, not a
   secret or legacy `service_role` key.
8. Verify all later-stage flags are explicitly `false`.
9. Save the variables. Do not deploy or redeploy yet.

Do **not** add `MY_TRUSTHUB_SUPABASE_SECRET_KEY` to Vercel. It is only for the
one-time local script in Step 2.

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
