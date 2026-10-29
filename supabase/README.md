# Supabase setup

Vpin stores its data in Supabase (Postgres) and signs people in with Supabase Auth. Live updates use Supabase Realtime.

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run `migrations/20261027000000_initial_schema.sql`. This creates the tables, the security rules (Row Level Security) and the live-update settings.
3. Go to **Project Settings → API** and copy these values into `.env`:
   - `VITE_SUPABASE_URL`: the Project URL
   - `VITE_SUPABASE_ANON_KEY`: the anon (or publishable) key, which browsers use
   - `SUPABASE_SERVICE_ROLE_KEY`: the service-role (or secret) key. It is for the server only. Never put `VITE_` in front of its name.

## 2. Sign-in settings (Authentication in the dashboard)

- **Sign In / Providers → Email**: on. Leave **Confirm email** on if new accounts should confirm their address.
- **Sign In / Providers → Anonymous sign-ins**: on. Guest review links use it: the server then gives each guest a pass for one project.
- **Sign In / Providers → Google**: on, with a Google OAuth client ID and secret. In Google Cloud, add Supabase's callback URL (shown on that page) to the client's redirect URIs.
- **URL Configuration**: set **Site URL** to the app address (e.g. `http://localhost:3000`, later the live URL), and add it to **Redirect URLs**. Sign-in links, password resets and Google sign-in return there.

## 3. Move the data from Firebase (once)

```bash
npm run migrate:import
```

This loads `migration/firebase-export.json` (made earlier with `npm run migrate:export`) into Supabase. Team members get a Supabase account with the same email. Passwords cannot be moved, so members sign in with Google, or click **Forgot?** once to set a new password. Run the import before starting the new server for the first time.

Keep `VPIN_SECRET_KEY` in `.env` unchanged. The saved WordPress passwords are encrypted with it.

## Checking the security rules

```bash
npm run test:db
```

This runs the migration on a local Postgres (PGlite) and checks what members, admins, guests and signed-out visitors can read and change.
