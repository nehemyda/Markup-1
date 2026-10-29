# Markup

Markup is a website review workspace for the Your Digital Agents team. Team members and clients drop feedback pins on live web pages. The team discusses each pin, tracks it to done, and fixes WordPress pages straight from the pin with AI.

## Features

- **Pin feedback on live pages.** Place pins on any page, with desktop, tablet and mobile views. A screenshot is taken automatically when a pin is placed or moved.
- **Guest review links.** Clients review and comment without an account, under the workspace's own name. Team-only pins stay internal.
- **Projects and folders.** Each project needs a PID and an AGID. Projects can have assignees, card previews and a Recently Deleted bin.
- **Client revisions.** Clients submit revision rounds with deadlines. Markup sends reminders and emails the team.
- **Fix with AI.** Uses Gemini to suggest and apply changes to WordPress pages built with Elementor, Divi, Gutenberg or site CSS. Every fix goes through the WebReview Connector plugin, which takes a backup first and has one-click undo.
- **Team tools.** Teams, out of office, an activity feed, a kanban board, QA scores, AI credit tracking, Google Chat alerts and in-app notifications.
- **Chrome extension.** Shows notifications and your open pins in the browser toolbar.

## Tech stack

| Part | Built with |
| --- | --- |
| Web app | React 19, Vite, Tailwind CSS 4, Motion |
| Server | Node.js and Express (`server.ts`, `server/`) |
| Database, sign-in, live updates | Supabase (Postgres with row-level security, Auth, Realtime) |
| AI | Google Gemini (`@google/genai`) |
| Page previews | Puppeteer |
| Email | Nodemailer over SMTP |

## Getting started

You need Node.js 24 and a Supabase project. For the Supabase setup, see [supabase/README.md](supabase/README.md).

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:3000
```

`.env.example` explains each setting. Never commit `.env`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app and server locally |
| `npm run build` | Builds the web app and server into `dist/` |
| `npm start` | Runs the built app |
| `npm run lint` | Type-checks the code |
| `npm run test:db` | Tests the database security rules on a local Postgres (PGlite) |
| `npm run wp:test` | Starts a local WordPress test site with the connector plugin |
| `npm run wp:zip` | Packages the WordPress plugin into `build/vpin-connector.zip` |
| `npm run ext:zip` | Packages the Chrome extension into `build/vpin-chrome-extension.zip` |

## Database changes

Database changes live in [supabase/migrations/](supabase/migrations/), one SQL file per change. The files are named `YYYYMMDDHHMMSS_description.sql`.

1. Add a new migration file. Don't edit one that has already been applied.
2. Run `npm run test:db` locally.
3. Commit and push to `main`.

The [Supabase migrations](.github/workflows/supabase-migrations.yml) workflow runs the tests. If they pass, it applies the new migrations to the live Supabase project. The workflow needs two repository secrets: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.

## Project structure

```
src/                 Web app (React)
  components/        Screens and dialogs
  lib/               Supabase client, sync, permissions, API helpers
server.ts            Express server entry point
server/              Server modules: auth, AI usage, WordPress, previews, email, trash
supabase/            Database migrations, security-rule tests, setup guide
chrome-extension/    Markup for Chrome (see its README)
wordpress-plugin/    WebReview Connector plugin and a local test setup
scripts/             One-off data scripts (Firebase-to-Supabase move)
```
