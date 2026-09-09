import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "qvvxvbcdmbjzrgvwjatw";
const REQUIRED_CONFIRMATION = "CREATE_ONE_MY_TRUSTHUB_CANARY";
const EXISTING_USERS_OVERRIDE = "I_ACCEPT_EXISTING_AUTH_USERS";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizedEmail(value) {
  const email = value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new Error("MY_TRUSTHUB_CANARY_EMAIL is invalid");
  }
  return email;
}

function validatedProjectUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== `${EXPECTED_PROJECT_REF}.supabase.co`
  ) {
    throw new Error(
      `MY_TRUSTHUB_SUPABASE_URL must target project ${EXPECTED_PROJECT_REF}`,
    );
  }
  return url.origin;
}

async function listAllUsers(client) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function safeResult({ created, user }) {
  return {
    created,
    user_id: user.id,
    entitlement: user.app_metadata?.my_trusthub_canary === true,
    email_confirmed: Boolean(user.email_confirmed_at),
  };
}

async function main() {
  if (required("MY_TRUSTHUB_CONFIRM_CREATE") !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `MY_TRUSTHUB_CONFIRM_CREATE must equal ${REQUIRED_CONFIRMATION}`,
    );
  }

  const email = normalizedEmail(required("MY_TRUSTHUB_CANARY_EMAIL"));
  const url = validatedProjectUrl(required("MY_TRUSTHUB_SUPABASE_URL"));
  const secret = required("MY_TRUSTHUB_SUPABASE_SECRET_KEY");
  const allowExistingUsers =
    process.env.MY_TRUSTHUB_ALLOW_EXISTING_UNRELATED_USERS?.trim() ===
    EXISTING_USERS_OVERRIDE;

  const client = createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const users = await listAllUsers(client);
  const matches = users.filter(
    (user) => user.email?.trim().toLowerCase() === email,
  );
  const unexpected = users.filter(
    (user) => user.email?.trim().toLowerCase() !== email,
  );

  if (matches.length > 1) {
    throw new Error("Refusing: more than one Auth user has the canary email");
  }
  if (unexpected.length && !allowExistingUsers) {
    throw new Error(
      `Refusing: ${unexpected.length} unrelated Auth user(s) already exist`,
    );
  }

  if (matches.length === 1) {
    const existing = matches[0];
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      app_metadata: {
        ...existing.app_metadata,
        my_trusthub_canary: true,
      },
    });
    if (error) throw error;
    console.log(JSON.stringify(safeResult({ created: false, user: data.user })));
    return;
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { my_trusthub_canary: true },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Supabase Auth returned no created user");
  console.log(JSON.stringify(safeResult({ created: true, user: data.user })));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown failure";
  console.error(`Canary creation failed: ${message}`);
  process.exitCode = 1;
});
